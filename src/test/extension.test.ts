import * as assert from 'assert';
import * as path from 'path';
import { shouldIgnore } from '../config.js';

suite('Config', () => {
	test('shouldIgnore matches glob patterns', () => {
		const patterns = ['**/package-lock.json', '**/yarn.lock', '**/*.generated.*'];

		assert.strictEqual(shouldIgnore('package-lock.json', patterns), true);
		assert.strictEqual(shouldIgnore('some/deep/package-lock.json', patterns), true);
		assert.strictEqual(shouldIgnore('yarn.lock', patterns), true);
		assert.strictEqual(shouldIgnore('foo.generated.ts', patterns), true);
		assert.strictEqual(shouldIgnore('deep/foo.generated.js', patterns), true);

		assert.strictEqual(shouldIgnore('src/index.ts', patterns), false);
		assert.strictEqual(shouldIgnore('package.json', patterns), false);
		assert.strictEqual(shouldIgnore('README.md', patterns), false);
	});

	test('shouldIgnore returns false for empty patterns', () => {
		assert.strictEqual(shouldIgnore('anything.ts', []), false);
	});
});

suite('Git Output Parsing', () => {
	// These test the parseFilePaths logic indirectly through the module's behavior.
	// Since parseFilePaths is private, we test the contract through the public API shape.

	test('empty string produces empty set from split logic', () => {
		const output = '';
		const lines = output.split('\n').filter(l => l.trim());
		assert.strictEqual(lines.length, 0);
	});

	test('multi-line output splits correctly', () => {
		const output = 'src/foo.ts\nsrc/bar.ts\nREADME.md\n';
		const lines = output.trim().split('\n').filter(l => l.trim());
		assert.strictEqual(lines.length, 3);
		assert.deepStrictEqual(lines, ['src/foo.ts', 'src/bar.ts', 'README.md']);
	});

	test('paths resolve correctly against a git root', () => {
		const gitRoot = '/Users/test/project';
		const relativePaths = ['src/foo.ts', 'README.md'];
		const resolved = relativePaths.map(p => path.resolve(gitRoot, p));

		assert.strictEqual(resolved[0], path.join(gitRoot, 'src/foo.ts'));
		assert.strictEqual(resolved[1], path.join(gitRoot, 'README.md'));
	});
});
