import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');
const { runCommand } = require('../../src/shared/process/commands');

async function runGit(args) {
  const result = await runCommand('git', args);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || 'git failed');
  }
  return result.stdout;
}

async function createTaskRepo() {
  const root = await createTempDir();
  const repoPath = path.join(root, 'repo');
  await fs.mkdir(repoPath, { recursive: true });
  await runGit(['init', repoPath]);
  await runGit(['-C', repoPath, 'config', 'user.email', 'test@example.com']);
  await runGit(['-C', repoPath, 'config', 'user.name', 'Test User']);
  await fs.writeFile(path.join(repoPath, 'README.md'), 'old line\n');
  await runGit(['-C', repoPath, 'add', 'README.md']);
  await runGit(['-C', repoPath, 'commit', '-m', 'initial']);
  const baseSha = (await runGit(['-C', repoPath, 'rev-parse', 'HEAD'])).trim();
  return { repoPath, baseSha };
}

async function writeTaskMeta(orchHome, meta) {
  const taskDir = path.join(orchHome, 'tasks', meta.taskId);
  await fs.mkdir(taskDir, { recursive: true });
  await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta));
}

describe('orchestrator task working tree diff', () => {
  it('returns tracked and untracked changes from the task creation base', async () => {
    const orchHome = await createTempDir();
    const { baseSha, repoPath } = await createTaskRepo();
    await fs.writeFile(path.join(repoPath, 'README.md'), 'new line\n');
    await fs.writeFile(path.join(repoPath, 'notes.txt'), 'one\ntwo\n');
    await writeTaskMeta(orchHome, {
      taskId: 'task-1',
      baseSha,
      branchName: 'main',
      worktreePath: repoPath
    });

    const orchestrator = new Orchestrator({ orchHome });
    const diff = await orchestrator.getTaskDiff('task-1');
    const status = await orchestrator.getTaskGitStatus({
      baseSha,
      branchName: 'main',
      worktreePath: repoPath
    });

    expect(diff.available).toBe(true);
    expect(diff.files.map((file) => file.path)).toEqual(['README.md', 'notes.txt']);
    expect(diff.files.find((file) => file.path === 'README.md')?.diff).toContain('+new line');
    expect(diff.files.find((file) => file.path === 'notes.txt')?.diff).toContain('new file mode');
    expect(status.diffStats).toEqual({ additions: 3, deletions: 1 });
    expect(status.hasChanges).toBe(true);
    expect(status.dirty).toBe(true);
  });
});
