import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveRefInRepo, parseUnifiedDiff } = require('../../src/orchestrator/git');

function createExecOrThrow({ tags = [] } = {}) {
  return async (command, args) => {
    if (command !== 'git') {
      throw new Error('unexpected command');
    }
    if (args[2] === 'show-ref') {
      const ref = args[4];
      if (tags.includes(ref)) {
        return { stdout: ref, stderr: '', code: 0 };
      }
      const error = new Error('not found');
      error.code = 1;
      throw error;
    }
    return { stdout: '', stderr: '', code: 0 };
  };
}

describe('orchestrator git helpers', () => {
  it('resolves refs in order', async () => {
    const execOrThrow = createExecOrThrow({ tags: ['refs/tags/v1'] });
    await expect(resolveRefInRepo(execOrThrow, '/tmp/repo', null)).resolves.toBe(null);
    await expect(resolveRefInRepo(execOrThrow, '/tmp/repo', 'refs/heads/main')).resolves.toBe(
      'refs/heads/main'
    );
    await expect(resolveRefInRepo(execOrThrow, '/tmp/repo', 'origin/main')).resolves.toBe(
      'refs/remotes/origin/main'
    );
    await expect(resolveRefInRepo(execOrThrow, '/tmp/repo', 'deadbeef')).resolves.toBe('deadbeef');
    await expect(resolveRefInRepo(execOrThrow, '/tmp/repo', 'v1')).resolves.toBe('refs/tags/v1');
    await expect(resolveRefInRepo(execOrThrow, '/tmp/repo', 'missing')).resolves.toBe(
      'refs/remotes/origin/missing'
    );
  });

  it('parses unified diff and marks oversized files', () => {
    const diff = [
      'diff --git a/dev/null b/new.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1 @@',
      '+hello'
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('new.txt');
    expect(files[0].tooLarge).toBe(false);

    const bigLines = Array.from({ length: 405 }, (_, index) => `+line-${index}`);
    const bigDiff = [`diff --git a/a.txt b/a.txt`, ...bigLines].join('\n');
    const bigFiles = parseUnifiedDiff(bigDiff);
    expect(bigFiles[0].tooLarge).toBe(true);
  });
});
