import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { computeGitFingerprint } = require('../../src/orchestrator/tasks/git-fingerprint');

function createFingerprintExec() {
  return async (command, args) => {
    expect(command).toBe('git');
    if (args.includes('ls-files')) {
      return { code: 0, stdout: 'b.txt\0a.txt\0missing.txt\0folder\0' };
    }
    if (args[2] === 'rev-parse') {
      return { code: 0, stdout: 'abc123\n' };
    }
    if (args[2] === 'status') {
      return { code: 0, stdout: '?? a.txt\0?? b.txt\0' };
    }
    if (args[2] === 'diff' && args.includes('--cached')) {
      return { code: 0, stdout: 'staged diff' };
    }
    if (args[2] === 'diff') {
      return { code: 0, stdout: 'unstaged diff' };
    }
    return { code: 1, stdout: '' };
  };
}

describe('git fingerprint', () => {
  it('returns null when no worktree or git output is available', async () => {
    const failingExec = async () => ({ code: 1, stdout: '' });

    await expect(computeGitFingerprint(failingExec, null)).resolves.toBeNull();
    await expect(computeGitFingerprint(failingExec, '/missing')).resolves.toBeNull();
  });

  it('hashes tracked state and readable untracked files deterministically', async () => {
    const worktreePath = await createTempDir();
    await fs.writeFile(path.join(worktreePath, 'a.txt'), 'alpha');
    await fs.writeFile(path.join(worktreePath, 'b.txt'), 'beta');
    await fs.mkdir(path.join(worktreePath, 'folder'));

    const first = await computeGitFingerprint(createFingerprintExec(), worktreePath);
    const second = await computeGitFingerprint(createFingerprintExec(), worktreePath);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });
});
