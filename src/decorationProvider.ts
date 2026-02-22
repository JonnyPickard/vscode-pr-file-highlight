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
		this.decorationMap.clear();

		for (const filePath of branchChanges) {
			this.decorationMap.set(filePath, 'branch');
		}

		// Uncommitted takes priority over branch
		for (const filePath of uncommitted) {
			this.decorationMap.set(filePath, 'uncommitted');
		}

		this._onDidChangeFileDecorations.fire(undefined);
	}

	clear(): void {
		this.decorationMap.clear();
		this._onDidChangeFileDecorations.fire(undefined);
	}

	dispose(): void {
		this._onDidChangeFileDecorations.dispose();
	}
}
