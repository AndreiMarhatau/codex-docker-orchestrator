import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildBranchPrompt,
  fallbackBranchName,
  validateBranchName
} = require('../../src/orchestrator/tasks/branch-name');

function createGitExec(responses = []) {
  const calls = [];
  const exec = async (command, args) => {
    calls.push({ command, args });
    const next = responses.shift();
    return next || { stdout: '', stderr: '', code: 0 };
  };
  exec.calls = calls;
  return exec;
}

describe('task branch names', () => {
  it('builds retry prompts with the previous rejection', () => {
    const prompt = buildBranchPrompt({
      userPrompt: 'Fix flaky tests',
      previousFailure: {
        branchName: 'bad branch',
        reason: 'contains spaces'
      }
    });

    expect(prompt).toContain('Fix flaky tests');
    expect(prompt).toContain('bad branch');
    expect(prompt).toContain('contains spaces');
    expect(fallbackBranchName('1234567890abcdef')).toBe('codex/12345678');
  });

  it('rejects malformed branch names before git validation', async () => {
    const exec = createGitExec();

    await expect(validateBranchName(exec, '/repo', '')).resolves.toMatchObject({
      valid: false,
      reason: 'branch name is empty'
    });
    await expect(validateBranchName(exec, '/repo', 'feature/work')).resolves.toMatchObject({
      valid: false,
      reason: 'branch name must start with codex/'
    });
    await expect(validateBranchName(exec, '/repo', `codex/${'a'.repeat(80)}`))
      .resolves.toMatchObject({ valid: false, reason: 'branch name is longer than 72 characters' });
    await expect(validateBranchName(exec, '/repo', 'codex/Bad Branch'))
      .resolves.toMatchObject({ valid: false, reason: 'branch name contains unsupported characters' });

    expect(exec.calls).toHaveLength(0);
  });

  it('rejects git-invalid, local, and remote branch conflicts', async () => {
    await expect(validateBranchName(createGitExec([
      { stdout: '', stderr: 'bad ref', code: 1 }
    ]), '/repo', 'codex/bad')).resolves.toMatchObject({
      valid: false,
      reason: 'bad ref'
    });

    await expect(validateBranchName(createGitExec([
      { stdout: 'stdout ref error', stderr: '', code: 1 }
    ]), '/repo', 'codex/stdout-error')).resolves.toMatchObject({
      valid: false,
      reason: 'stdout ref error'
    });

    await expect(validateBranchName(createGitExec([
      { stdout: '', stderr: '', code: 1 }
    ]), '/repo', 'codex/empty-error')).resolves.toMatchObject({
      valid: false,
      reason: 'git rejected the branch name'
    });

    await expect(validateBranchName(createGitExec([
      { stdout: '', stderr: '', code: 0 },
      { stdout: 'refs/heads/codex/existing', stderr: '', code: 0 }
    ]), '/repo', 'codex/existing')).resolves.toMatchObject({
      valid: false,
      reason: 'branch already exists locally'
    });

    await expect(validateBranchName(createGitExec([
      { stdout: '', stderr: '', code: 0 },
      { stdout: '', stderr: 'not found', code: 1 },
      { stdout: 'abc123\trefs/heads/codex/remote\n', stderr: '', code: 0 }
    ]), '/repo', 'codex/remote')).resolves.toMatchObject({
      valid: false,
      reason: 'branch already exists on origin'
    });
  });

  it('accepts valid branch names when the remote lookup is empty or unavailable', async () => {
    await expect(validateBranchName(createGitExec([
      { stdout: '', stderr: '', code: 0 },
      { stdout: '', stderr: 'not found', code: 1 },
      { stdout: '', stderr: '', code: 0 }
    ]), '/repo', ' codex/valid-branch ')).resolves.toEqual({
      valid: true,
      branchName: 'codex/valid-branch'
    });

    await expect(validateBranchName(createGitExec([
      { stdout: '', stderr: '', code: 0 },
      { stdout: '', stderr: 'not found', code: 1 },
      { stdout: '', stderr: 'offline', code: 1 }
    ]), '/repo', 'codex/offline')).resolves.toEqual({
      valid: true,
      branchName: 'codex/offline'
    });
  });
});
