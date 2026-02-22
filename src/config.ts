import * as vscode from 'vscode';
import { minimatch } from 'minimatch';
import { SECTION, DEFAULTS } from './constants.js';
import { branchExists } from './gitService.js';

export interface DecorationStyle {
	badge: string;
	tooltip: string;
}

export interface ExtensionConfig {
	baseBranch: string | string[];
	enabled: boolean;
	branchChange: DecorationStyle;
	uncommitted: DecorationStyle;
	ignorePaths: string[];
}

export function getConfig(): ExtensionConfig {
	const cfg = vscode.workspace.getConfiguration(SECTION);
	return {
		baseBranch: cfg.get<string | string[]>('baseBranch', DEFAULTS.baseBranch),
		enabled: cfg.get<boolean>('enabled', DEFAULTS.enabled),
		branchChange: {
			badge: cfg.get<string>('branchChange.badge', DEFAULTS.branchChange.badge),
			tooltip: cfg.get<string>('branchChange.tooltip', DEFAULTS.branchChange.tooltip),
		},
		uncommitted: {
			badge: cfg.get<string>('uncommitted.badge', DEFAULTS.uncommitted.badge),
			tooltip: cfg.get<string>('uncommitted.tooltip', DEFAULTS.uncommitted.tooltip),
		},
		ignorePaths: cfg.get<string[]>('ignorePaths', [...DEFAULTS.ignorePaths]),
	};
}

export async function resolveBaseBranch(gitRoot: string, baseBranch: string | string[]): Promise<string | null> {
	const candidates = Array.isArray(baseBranch) ? baseBranch : [baseBranch];

	for (const branch of candidates) {
		if (await branchExists(gitRoot, branch)) {
			return branch;
		}
	}

	vscode.window.showWarningMessage(
		`PR File Highlight: Base branch not found. Tried: ${candidates.join(', ')}. Use "Set Base Branch" command to configure.`
	);
	return null;
}

export function shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
	return ignorePatterns.some(pattern => minimatch(relativePath, pattern));
}
