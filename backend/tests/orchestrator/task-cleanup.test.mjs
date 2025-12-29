import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function writeEnv(orchHome, envId) {
  const envDir = path.join(orchHome, 'envs', envId);
  await fs.mkdir(path.join(envDir, 'mirror'), { recursive: true });
  await fs.writeFile(path.join(envDir, 'repo.url'), 'git@example.com:repo.git');
  await fs.writeFile(path.join(envDir, 'default_branch'), 'main');
}

describe('orchestrator cleanup', () => {
  it('cleans up context repos even when env is missing', async () => {
    const orchHome = await createTempDir();
    const exec = async (command, args) => {
      if (args.includes('worktree') && args.includes('remove')) {
        const worktreePath = args[args.length - 1];
        const isContext = worktreePath.includes('context');
        return isContext
          ? { stdout: '', stderr: 'not a working tree', code: 1 }
          : { stdout: '', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });

    await writeEnv(orchHome, 'env-1');

    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    const contextPath = path.join(taskDir, 'context', 'context-repo');
    await fs.mkdir(contextPath, { recursive: true });

    const meta = {
      taskId: 'task-1',
      envId: 'env-1',
      worktreePath: path.join(taskDir, 'worktree'),
      contextRepos: [
        { envId: 'missing-env', worktreePath: contextPath },
        { envId: 'env-1', worktreePath: contextPath }
      ]
    };
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta));

    await orchestrator.deleteTask('task-1');
    await expect(fs.stat(contextPath)).rejects.toThrow();
  });

  it('throws when worktree removal fails with a hard error', async () => {
    const orchHome = await createTempDir();
    const exec = async (command, args) => {
      if (args.includes('worktree') && args.includes('remove')) {
        return { stdout: '', stderr: 'fatal: error', code: 1 };
      }
      return { stdout: '', stderr: '', code: 0 };
    };
    const orchestrator = new Orchestrator({ orchHome, exec });

    await writeEnv(orchHome, 'env-1');

    const taskDir = path.join(orchHome, 'tasks', 'task-2');
    const meta = {
      taskId: 'task-2',
      envId: 'env-1',
      worktreePath: path.join(taskDir, 'worktree'),
      contextRepos: []
    };
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta));

    await expect(orchestrator.deleteTask('task-2')).rejects.toThrow(/fatal/);
  });

  it('pushes without creating a PR when GitHub config is missing', async () => {
    const orchHome = await createTempDir();
    const exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const orchestrator = new Orchestrator({ orchHome, exec });

    const taskId = 'task-3';
    const taskDir = path.join(orchHome, 'tasks', taskId);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({
        taskId,
        envId: 'env-1',
        worktreePath: '/tmp/repo',
        branchName: 'feature'
      })
    );

    const originalToken = process.env.ORCH_GITHUB_TOKEN;
    const originalRepo = process.env.ORCH_GITHUB_REPO;
    delete process.env.ORCH_GITHUB_TOKEN;
    delete process.env.ORCH_GITHUB_REPO;
    try {
      const result = await orchestrator.pushTask(taskId);
      expect(result).toEqual({ pushed: true, prCreated: false });
    } finally {
      if (originalToken === undefined) {
        delete process.env.ORCH_GITHUB_TOKEN;
      } else {
        process.env.ORCH_GITHUB_TOKEN = originalToken;
      }
      if (originalRepo === undefined) {
        delete process.env.ORCH_GITHUB_REPO;
      } else {
        process.env.ORCH_GITHUB_REPO = originalRepo;
      }
    }
  });

  it('throws when GitHub PR creation fails', async () => {
    const orchHome = await createTempDir();
    const exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const fetch = async () => ({
      ok: false,
      text: async () => 'nope'
    });
    const orchestrator = new Orchestrator({ orchHome, exec, fetch });

    await writeEnv(orchHome, 'env-1');

    const taskId = 'task-4';
    const taskDir = path.join(orchHome, 'tasks', taskId);
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({
        taskId,
        envId: 'env-1',
        worktreePath: '/tmp/repo',
        branchName: 'feature'
      })
    );

    const originalToken = process.env.ORCH_GITHUB_TOKEN;
    const originalRepo = process.env.ORCH_GITHUB_REPO;
    process.env.ORCH_GITHUB_TOKEN = 'token';
    process.env.ORCH_GITHUB_REPO = 'org/repo';
    try {
      await expect(orchestrator.pushTask(taskId)).rejects.toThrow('nope');
    } finally {
      if (originalToken === undefined) {
        delete process.env.ORCH_GITHUB_TOKEN;
      } else {
        process.env.ORCH_GITHUB_TOKEN = originalToken;
      }
      if (originalRepo === undefined) {
        delete process.env.ORCH_GITHUB_REPO;
      } else {
        process.env.ORCH_GITHUB_REPO = originalRepo;
      }
    }
  });
});
