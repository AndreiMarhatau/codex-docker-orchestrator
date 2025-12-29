import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator task meta status basics', () => {
  it('computes git status fields', async () => {
    const exec = async (command, args) => {
      if (args.includes('status')) {
        return { stdout: ' M file.txt', stderr: '', code: 0 };
      }
      if (args.includes('diff') && args.includes('--quiet')) {
        return { stdout: '', stderr: '', code: 1 };
      }
      if (args.includes('rev-parse')) {
        return { stdout: 'headsha\n', stderr: '', code: 0 };
      }
      if (args.includes('ls-remote')) {
        return { stdout: 'headsha\trefs/heads/main\n', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    const status = await orchestrator.getTaskGitStatus({
      worktreePath: '/tmp/repo',
      baseSha: 'base',
      branchName: 'main'
    });
    expect(status.dirty).toBe(true);
    expect(status.hasChanges).toBe(true);
    expect(status.pushed).toBe(true);
  });

  it('marks hasChanges when dirty but diff is clean', async () => {
    const exec = async (command, args) => {
      if (args.includes('status')) {
        return { stdout: ' M file.txt', stderr: '', code: 0 };
      }
      if (args.includes('diff') && args.includes('--quiet')) {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args.includes('rev-parse')) {
        return { stdout: 'headsha\n', stderr: '', code: 0 };
      }
      if (args.includes('ls-remote')) {
        return { stdout: 'headsha\trefs/heads/main\n', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    const status = await orchestrator.getTaskGitStatus({
      worktreePath: '/tmp/repo',
      baseSha: 'base',
      branchName: 'main'
    });
    expect(status.hasChanges).toBe(true);
  });

  it('handles missing base sha and remote failures', async () => {
    const exec = async (command, args) => {
      if (args.includes('status')) {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args.includes('rev-parse')) {
        return { stdout: 'headsha\n', stderr: '', code: 0 };
      }
      if (args.includes('ls-remote')) {
        return { stdout: '', stderr: 'fail', code: 1 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    const status = await orchestrator.getTaskGitStatus({
      worktreePath: '/tmp/repo',
      baseSha: null,
      branchName: 'main'
    });
    expect(status.hasChanges).toBe(null);
    expect(status.pushed).toBe(null);
    expect(status.dirty).toBe(false);
  });
});

describe('orchestrator task meta status edge cases', () => {
  it('returns null dirty status on git errors', async () => {
    const exec = async (command, args) => {
      if (args.includes('status')) {
        return { stdout: '', stderr: '', code: 1 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    const status = await orchestrator.getTaskGitStatus({
      worktreePath: '/tmp/repo',
      baseSha: 'base',
      branchName: 'main'
    });
    expect(status.dirty).toBe(null);
  });

  it('returns null when worktree path is missing', async () => {
    const orchestrator = new Orchestrator({
      exec: async () => ({ stdout: '', stderr: '', code: 0 })
    });
    const status = await orchestrator.getTaskGitStatus({ worktreePath: null });
    expect(status).toBe(null);
  });

  it('marks pushed false when remote head is missing', async () => {
    const exec = async (command, args) => {
      if (args.includes('status')) {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args.includes('diff') && args.includes('--quiet')) {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args.includes('rev-parse')) {
        return { stdout: 'headsha\n', stderr: '', code: 0 };
      }
      if (args.includes('ls-remote')) {
        return { stdout: '\n', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    const status = await orchestrator.getTaskGitStatus({
      worktreePath: '/tmp/repo',
      baseSha: 'base',
      branchName: 'main'
    });
    expect(status.dirty).toBe(false);
    expect(status.hasChanges).toBe(false);
    expect(status.pushed).toBe(false);
  });

  it('leaves pushed null when local head is unavailable', async () => {
    const exec = async (command, args) => {
      if (args.includes('status')) {
        return { stdout: '', stderr: '', code: 0 };
      }
      if (args.includes('rev-parse')) {
        return { stdout: '', stderr: 'missing', code: 1 };
      }
      if (args.includes('ls-remote')) {
        return { stdout: 'remote\trefs/heads/main\n', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ exec });
    const status = await orchestrator.getTaskGitStatus({
      worktreePath: '/tmp/repo',
      baseSha: null,
      branchName: 'main'
    });
    expect(status.pushed).toBe(null);
  });
});

describe('orchestrator task meta diff', () => {
  it('returns unavailable diff when base sha is missing', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({
      orchHome,
      exec: async () => ({ stdout: '', stderr: '', code: 0 })
    });
    await fs.mkdir(path.join(orchHome, 'tasks', 'task-1'), { recursive: true });
    await fs.writeFile(
      path.join(orchHome, 'tasks', 'task-1', 'meta.json'),
      JSON.stringify({ taskId: 'task-1', baseSha: null })
    );
    const diff = await orchestrator.getTaskDiff('task-1');
    expect(diff.available).toBe(false);
  });

  it('returns unavailable diff when git fails', async () => {
    const orchHome = await createTempDir();
    const exec = async () => ({ stdout: '', stderr: 'fail', code: 1 });
    const orchestrator = new Orchestrator({ orchHome, exec });
    const taskDir = path.join(orchHome, 'tasks', 'task-2');
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({ taskId: 'task-2', baseSha: 'base', worktreePath: '/tmp/repo' })
    );
    const diff = await orchestrator.getTaskDiff('task-2');
    expect(diff.available).toBe(false);
  });
});
