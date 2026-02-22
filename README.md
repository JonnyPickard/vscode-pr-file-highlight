# PR File Highlight

A VS Code extension that decorates files in the Explorer based on their git change status relative to a configurable base branch. Quickly see which files are part of your current branch's changeset without opening the Source Control panel.

## How it works

The extension uses **plain git only** — no GitHub CLI, no API tokens, no PR detection. It runs `git diff --name-only <baseBranch>...HEAD` to find files that differ between your current branch and the configured base branch (defaults to `main`). Decorations update automatically when you switch branches, commit, or save files.

**Requirements:** Git must be installed and available on your `PATH` (it almost certainly already is if you're using VS Code with git repos).

## Features

- **Branch changes** — files changed vs the base branch get a `●` badge, propagated up through parent directories
- **Uncommitted changes** — unstaged/staged files get a `◌` badge (takes priority over branch badge)
- **Configurable base branch** — supports a single branch name or an ordered fallback list (e.g. `["main", "master"]`)
- **Worktree support** — works correctly in git worktrees
- **Status bar indicator** — shows the current base branch; click to change it
- **Commands** via the command palette:
  - `PR File Highlight: Toggle` — enable/disable
  - `PR File Highlight: Refresh` — force refresh
  - `PR File Highlight: Set Base Branch` — pick from local branches

## Configuration

All settings are under the `prFileHighlight` namespace:

| Setting | Default | Description |
|---|---|---|
| `prFileHighlight.baseBranch` | `"main"` | Branch to diff against. Use an array for fallback, e.g. `["main", "master"]` |
| `prFileHighlight.enabled` | `true` | Enable/disable decorations |
| `prFileHighlight.branchChange.badge` | `"●"` | Badge for branch-changed files (max 2 chars) |
| `prFileHighlight.branchChange.tooltip` | `"Changed in branch"` | Tooltip for branch-changed files |
| `prFileHighlight.uncommitted.badge` | `"◌"` | Badge for uncommitted changes (max 2 chars) |
| `prFileHighlight.uncommitted.tooltip` | `"Uncommitted change"` | Tooltip for uncommitted files |
| `prFileHighlight.ignorePaths` | `["**/package-lock.json", "**/yarn.lock", "**/*.generated.*"]` | Glob patterns to never decorate |

Colors can be themed via `prFileHighlight.branchChangeColor` and `prFileHighlight.uncommittedColor` in your `settings.json` `workbench.colorCustomizations`.

## Contributing

### Prerequisites

- Node.js 18+
- VS Code or VS Code Insiders

### Setup

```bash
git clone https://github.com/JonnyPickard/vscode-pr-file-highlight.git
cd vscode-pr-file-highlight
npm install
```

### Running in development

Press **F5** in VS Code to open an Extension Development Host with the extension loaded.

Or compile manually:

```bash
npm run compile   # one-off build
npm run watch     # rebuild on save
```

### Debugging

The extension logs to the **PR File Highlight** output channel (View → Output → select from dropdown). You'll see git root discovery, base branch resolution, and exactly how many files were decorated.

### Linting

```bash
npm run lint
```

### Building and installing locally

```bash
npm run compile
npx @vscode/vsce package              # produces pr-file-highlight-<version>.vsix
code --install-extension pr-file-highlight-*.vsix --force
```

Then reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window").

## Releasing

Releases are automated via GitHub Actions on a version tag push:

```bash
npm version patch   # or minor / major — bumps version + creates git tag
git push --follow-tags
```

This triggers the release workflow which:

1. Compiles and packages the `.vsix`
2. Creates a GitHub Release with the `.vsix` attached
3. Publishes to the VS Code Marketplace (requires `VSCE_PAT` secret)
4. Publishes to Open VSX (requires `OVSX_PAT` secret)

### Setting up publish secrets

Add the following to your GitHub repo secrets (Settings → Secrets → Actions):

- `VSCE_PAT` — Personal Access Token from [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) with **Marketplace (publish)** scope
- `OVSX_PAT` — Token from [open-vsx.org](https://open-vsx.org) (user settings → Access Tokens)

## License

MIT
