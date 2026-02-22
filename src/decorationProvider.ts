import * as vscode from 'vscode';
import { THEME_COLORS } from './constants.js';

export type FileCategory = 'branch' | 'uncommitted';

export class PrFileDecorationProvider implements vscode.FileDecorationProvider {
	private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	private decorationMap = new Map<string, FileCategory>();

	provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
		const category = this.decorationMap.get(uri.fsPath);
		if (!category) {
			return undefined;
		}

		const cfg = vscode.workspace.getConfiguration('prFileHighlight');
		const style = category === 'uncommitted'
			? { badge: cfg.get<string>('uncommitted.badge', '◌'), tooltip: cfg.get<string>('uncommitted.tooltip', 'Uncommitted change') }
			: { badge: cfg.get<string>('branchChange.badge', '●'), tooltip: cfg.get<string>('branchChange.tooltip', 'Changed in branch') };
		const colorId = category === 'uncommitted'
			? THEME_COLORS.uncommitted
			: THEME_COLORS.branchChange;

		const decoration = new vscode.FileDecoration(
			style.badge,
			style.tooltip,
			new vscode.ThemeColor(colorId)
		);
		decoration.propagate = true;
		return decoration;
	}

	updateDecorations(
		branchChanges: Set<string>,
		uncommitted: Set<string>,
	): void {
		const previousPaths = new Set(this.decorationMap.keys());
		this.decorationMap.clear();

		for (const filePath of branchChanges) {
			this.decorationMap.set(filePath, 'branch');
		}

		// Uncommitted takes priority over branch
		for (const filePath of uncommitted) {
			this.decorationMap.set(filePath, 'uncommitted');
		}

		// Fire with specific URIs so VS Code discovers files deep in the tree
		// and can propagate decorations up to parent directories.
		// Include previous paths too so stale decorations get cleared.
		const affectedPaths = new Set([...previousPaths, ...this.decorationMap.keys()]);
		this._onDidChangeFileDecorations.fire(
			[...affectedPaths].map(p => vscode.Uri.file(p))
		);
	}

	clear(): void {
		const uris = [...this.decorationMap.keys()].map(p => vscode.Uri.file(p));
		this.decorationMap.clear();
		this._onDidChangeFileDecorations.fire(uris);
	}

	dispose(): void {
		this._onDidChangeFileDecorations.dispose();
	}
}
