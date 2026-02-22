export const COMMANDS = {
	toggle: 'prFileHighlight.toggle',
	refresh: 'prFileHighlight.refresh',
	setBaseBranch: 'prFileHighlight.setBaseBranch',
} as const;

export const SECTION = 'prFileHighlight';

export const THEME_COLORS = {
	branchChange: 'prFileHighlight.branchChangeColor',
	uncommitted: 'prFileHighlight.uncommittedColor',
} as const;

export const DEFAULTS = {
	baseBranch: 'main' as string | string[],
	enabled: true,
	branchChange: {
		badge: '●',
		tooltip: 'Changed in branch',
	},
	uncommitted: {
		badge: '◌',
		tooltip: 'Uncommitted change',
	},
	ignorePaths: ['**/package-lock.json', '**/yarn.lock', '**/*.generated.*'],
} as const;
