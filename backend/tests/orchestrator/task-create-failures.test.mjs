import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator create task failures', () => {
  it('marks task failed and cleans up sidecar when deferred run startup fails', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });
    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    orchestrator.startCodexRun = () => {
      throw new Error('run failed');
    };

    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work',
      useHostDockerSocket: true
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'failed');

    expect(
      exec.calls.some((call) => call.command === 'docker' && call.args[0] === 'rm')
    ).toBe(true);
    expect(
      exec.calls.some(
        (call) =>
          call.command === 'docker' && call.args[0] === 'volume' && call.args[1] === 'rm'
      )
    ).toBe(true);
    const taskMetaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(taskMetaPath, 'utf8'));
    expect(meta.error).toContain('run failed');
    expect(meta.runs[0].failedBeforeSpawn).toBe(true);
    const detail = await orchestrator.getTask(task.taskId);
    expect(detail.runLogs[0].failedBeforeSpawn).toBe(true);
  });

  it('fails immediately before deferred startup when context resolution fails', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });
    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    orchestrator.resolveContextRepos = async () => {
      throw new Error('context failed');
    };

    await expect(
      orchestrator.createTask({
        envId: env.envId,
        ref: 'main',
        prompt: 'Do work',
        useHostDockerSocket: true
      })
    ).rejects.toThrow(/context failed/);

    expect(
      exec.calls.some(
        (call) =>
          call.command === 'git' &&
          call.args.includes('worktree') &&
          call.args.includes('remove')
      )
    ).toBe(false);
    expect(
      exec.calls.some((call) => call.command === 'docker' && call.args[0] === 'rm')
    ).toBe(false);
  });

  it('cleans the git worktree when initial file creation fails after checkout', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const orchestrator = new Orchestrator({ orchHome, exec });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const blockedArtifactsRoot = path.join(orchHome, 'blocked-artifacts');
    await fs.writeFile(blockedArtifactsRoot, 'not a directory');
    orchestrator.runArtifactsDir = () => path.join(blockedArtifactsRoot, 'run-001');

    await expect(
      orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' })
    ).rejects.toThrow();

    const addCall = exec.calls.find(
      (call) => call.command === 'git' && call.args.includes('worktree') && call.args.includes('add')
    );
    const worktreePath = addCall.args[addCall.args.indexOf('add') + 1];
    expect(exec.calls.some(
      (call) =>
        call.command === 'git' &&
        call.args.includes('worktree') &&
        call.args.includes('remove') &&
        call.args.includes(worktreePath)
    )).toBe(true);
    await expect(fs.stat(worktreePath)).rejects.toThrow();
  });
});
