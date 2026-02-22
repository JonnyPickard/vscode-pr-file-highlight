import * as vscode from 'vscode';
import { COMMANDS, SECTION } from './constants.js';
import { getConfig, resolveBaseBranch, shouldIgnore } from './config.js';
import { findGitRoot, findGitDir, getBranchChanges, getUncommittedChanges, getLocalBranches } from './gitService.js';
import { PrFileDecorationProvider } from './decorationProvider.js';

let provider: PrFileDecorationProvider;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let gitRoots: string[] = [];
let gitDirs: string[] = [];
let cachedBranchChanges = new Map<string, Set<string>>();
let refreshAllTimer: ReturnType<typeof setTimeout> | undefined;
let refreshUncommittedTimer: ReturnType<typeof setTimeout> | undefined;

export async function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('PR File Highlight');
	context.subscriptions.push(outputChannel);
	outputChannel.appendLine('Activating PR File Highlight');

	provider = new PrFileDecorationProvider();
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(provider),
		provider
	);

	// Find git roots and git dirs (git dir differs from root in worktrees)
	const gitInfo = await discoverGitInfo();
	gitRoots = gitInfo.roots;
	gitDirs = gitInfo.dirs;
	outputChannel.appendLine(`Found ${gitRoots.length} git root(s): ${gitRoots.join(', ')}`);
	outputChannel.appendLine(`Git dirs: ${gitDirs.join(', ')}`);

	// Status bar
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBarItem.command = COMMANDS.setBaseBranch;
	context.subscriptions.push(statusBarItem);
	updateStatusBar();

	// Commands
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMANDS.toggle, toggleCommand),
		vscode.commands.registerCommand(COMMANDS.refresh, () => refreshAll()),
		vscode.commands.registerCommand(COMMANDS.setBaseBranch, setBaseBranchCommand),
	);

	// File system watchers scoped to each git dir (works for worktrees too)
	for (const gitDir of gitDirs) {
		const base = vscode.Uri.file(gitDir);
		const headWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(base, 'HEAD')
		);
		const indexWatcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(base, 'index')
		);
		headWatcher.onDidChange(() => { outputChannel.appendLine('HEAD changed, refreshing...'); debouncedRefreshAll(); });
		indexWatcher.onDidChange(() => { outputChannel.appendLine('index changed, refreshing...'); debouncedRefreshAll(); });
		context.subscriptions.push(headWatcher, indexWatcher);
	}

	// File save → refresh uncommitted only
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(() => debouncedRefreshUncommitted())
	);

	// Config change
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(SECTION)) {
				updateStatusBar();
				refreshAll();
			}
		})
	);

	// Initial scan
	const config = getConfig();
	outputChannel.appendLine(`Enabled: ${config.enabled}, base branch: ${JSON.stringify(config.baseBranch)}`);
	if (config.enabled) {
		await refreshAll();
	}
}

async function discoverGitInfo(): Promise<{ roots: string[]; dirs: string[] }> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders) {
		return { roots: [], dirs: [] };
	}

	const roots: string[] = [];
	const dirs: string[] = [];
	for (const folder of folders) {
		const root = await findGitRoot(folder.uri.fsPath);
		if (root && !roots.includes(root)) {
			roots.push(root);
			const gitDir = await findGitDir(folder.uri.fsPath);
			if (gitDir) {
				dirs.push(gitDir);
			}
		}
	}
	return { roots, dirs };
}

function debouncedRefreshAll() {
	if (refreshAllTimer) {
		clearTimeout(refreshAllTimer);
	}
	refreshAllTimer = setTimeout(() => refreshAll(), 300);
}

function debouncedRefreshUncommitted() {
	if (refreshUncommittedTimer) {
		clearTimeout(refreshUncommittedTimer);
	}
	refreshUncommittedTimer = setTimeout(() => refreshUncommitted(), 500);
}

async function refreshAll() {
	const config = getConfig();
	if (!config.enabled) {
		provider.clear();
		return;
	}

	const allBranchChanges = new Set<string>();
	const allUncommitted = new Set<string>();

	for (const gitRoot of gitRoots) {
		const baseBranch = await resolveBaseBranch(gitRoot, config.baseBranch);
		if (!baseBranch) {
			outputChannel.appendLine(`No base branch found for ${gitRoot} (tried: ${JSON.stringify(config.baseBranch)})`);
			continue;
		}

		const branchChanges = await getBranchChanges(gitRoot, baseBranch);
		const uncommitted = await getUncommittedChanges(gitRoot);

		outputChannel.appendLine(`${gitRoot}: ${branchChanges.size} branch changes vs "${baseBranch}", ${uncommitted.size} uncommitted`);
		if (branchChanges.size > 0) {
			outputChannel.appendLine(`  Branch changed files: ${[...branchChanges].map(p => p.substring(gitRoot.length + 1)).join(', ')}`);
		}

		cachedBranchChanges.set(gitRoot, branchChanges);

		for (const p of branchChanges) {
			const rel = p.substring(gitRoot.length + 1);
			if (!shouldIgnore(rel, config.ignorePaths)) {
				allBranchChanges.add(p);
			}
		}
		for (const p of uncommitted) {
			const rel = p.substring(gitRoot.length + 1);
			if (!shouldIgnore(rel, config.ignorePaths)) {
				allUncommitted.add(p);
			}
		}
	}

	outputChannel.appendLine(`Decorating ${allBranchChanges.size} branch-changed + ${allUncommitted.size} uncommitted files`);
	provider.updateDecorations(allBranchChanges, allUncommitted);
}

async function refreshUncommitted() {
	const config = getConfig();
	if (!config.enabled) {
		return;
	}

	const allBranchChanges = new Set<string>();
	const allUncommitted = new Set<string>();

	for (const gitRoot of gitRoots) {
		const cached = cachedBranchChanges.get(gitRoot);
		if (cached) {
			for (const p of cached) {
				const rel = p.substring(gitRoot.length + 1);
				if (!shouldIgnore(rel, config.ignorePaths)) {
					allBranchChanges.add(p);
				}
			}
		}

		const uncommitted = await getUncommittedChanges(gitRoot);
		for (const p of uncommitted) {
			const rel = p.substring(gitRoot.length + 1);
			if (!shouldIgnore(rel, config.ignorePaths)) {
				allUncommitted.add(p);
			}
		}
	}

	provider.updateDecorations(allBranchChanges, allUncommitted);
}

async function toggleCommand() {
	const config = vscode.workspace.getConfiguration(SECTION);
	const current = config.get<boolean>('enabled', true);
	await config.update('enabled', !current, vscode.ConfigurationTarget.Workspace);

	if (current) {
		provider.clear();
		vscode.window.showInformationMessage('PR File Highlight: Disabled');
	} else {
		await refreshAll();
		vscode.window.showInformationMessage('PR File Highlight: Enabled');
	}
	updateStatusBar();
}

async function setBaseBranchCommand() {
	const branches: string[] = [];
	for (const gitRoot of gitRoots) {
		const localBranches = await getLocalBranches(gitRoot);
		for (const b of localBranches) {
			if (!branches.includes(b)) {
				branches.push(b);
			}
		}
	}

	if (branches.length === 0) {
		vscode.window.showWarningMessage('PR File Highlight: No local branches found.');
		return;
	}

	const selected = await vscode.window.showQuickPick(branches, {
		placeHolder: 'Select base branch to diff against',
	});

	if (selected) {
		const config = vscode.workspace.getConfiguration(SECTION);
		await config.update('baseBranch', selected, vscode.ConfigurationTarget.Workspace);
		updateStatusBar();
		await refreshAll();
	}
}

function updateStatusBar() {
	const config = getConfig();
	const baseBranch = Array.isArray(config.baseBranch) ? config.baseBranch[0] : config.baseBranch;

	if (config.enabled) {
		statusBarItem.text = `$(git-compare) ${baseBranch}`;
		statusBarItem.tooltip = `PR File Highlight: Comparing against ${baseBranch}`;
		statusBarItem.show();
	} else {
		statusBarItem.text = `$(git-compare) ${baseBranch} (off)`;
		statusBarItem.tooltip = 'PR File Highlight: Disabled';
		statusBarItem.show();
	}
}

export function deactivate() {
	if (refreshAllTimer) {
		clearTimeout(refreshAllTimer);
	}
	if (refreshUncommittedTimer) {
		clearTimeout(refreshUncommittedTimer);
	}
}
