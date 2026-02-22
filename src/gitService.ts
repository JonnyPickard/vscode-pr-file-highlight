import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string> {
	const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
	return stdout.trim();
}

export async function findGitRoot(folderPath: string): Promise<string | null> {
	try {
		return await git(['rev-parse', '--show-toplevel'], folderPath);
	} catch {
		return null;
	}
}

/** Returns the absolute path to the .git dir — differs from root in worktrees */
export async function findGitDir(folderPath: string): Promise<string | null> {
	try {
		return await git(['rev-parse', '--absolute-git-dir'], folderPath);
	} catch {
		return null;
	}
}

export async function getBranchChanges(gitRoot: string, baseBranch: string): Promise<Set<string>> {
	try {
		const output = await git(
			['diff', '--name-only', '--ignore-submodules', `${baseBranch}...HEAD`],
			gitRoot
		);
		return parseFilePaths(output, gitRoot);
	} catch {
		return new Set();
	}
}

export async function getUncommittedChanges(gitRoot: string): Promise<Set<string>> {
	try {
		const output = await git(
			['diff', '--name-only', '--ignore-submodules', 'HEAD'],
			gitRoot
		);
		// Also include untracked staged files
		const stagedOutput = await git(
			['diff', '--name-only', '--cached', '--ignore-submodules'],
			gitRoot
		);
		const paths = parseFilePaths(output, gitRoot);
		for (const p of parseFilePaths(stagedOutput, gitRoot)) {
			paths.add(p);
		}
		return paths;
	} catch {
		return new Set();
	}
}

export async function getLocalBranches(gitRoot: string): Promise<string[]> {
	try {
		const output = await git(['branch', '--list', '--format=%(refname:short)'], gitRoot);
		if (!output) {
			return [];
		}
		return output.split('\n').filter(Boolean);
	} catch {
		return [];
	}
}

export async function branchExists(gitRoot: string, branch: string): Promise<boolean> {
	try {
		await git(['rev-parse', '--verify', branch], gitRoot);
		return true;
	} catch {
		return false;
	}
}

function parseFilePaths(output: string, gitRoot: string): Set<string> {
	if (!output) {
		return new Set();
	}
	const paths = new Set<string>();
	for (const line of output.split('\n')) {
		const trimmed = line.trim();
		if (trimmed) {
			paths.add(path.resolve(gitRoot, trimmed));
		}
	}
	return paths;
}
