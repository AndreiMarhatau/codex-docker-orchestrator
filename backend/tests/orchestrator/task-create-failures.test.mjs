import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator create task failures', () => {
  it('cleans up worktree and sidecar when run startup fails', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });
    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    orchestrator.startCodexRun = () => {
      throw new Error('run failed');
    };

    await expect(
      orchestrator.createTask({
        envId: env.envId,
        ref: 'main',
        prompt: 'Do work',
        useHostDockerSocket: true
      })
    ).rejects.toThrow(/run failed/);

    expect(
      exec.calls.some(
        (call) =>
          call.command === 'git' &&
          call.args.includes('worktree') &&
          call.args.includes('remove')
      )
    ).toBe(true);
    expect(
      exec.calls.some(
        (call) =>
          call.command === 'git' &&
          call.args.includes('worktree') &&
          call.args.includes('prune')
      )
    ).toBe(true);
    expect(
      exec.calls.some((call) => call.command === 'docker' && call.args[0] === 'rm')
    ).toBe(true);
    expect(
      exec.calls.some(
        (call) =>
          call.command === 'docker' && call.args[0] === 'volume' && call.args[1] === 'rm'
      )
    ).toBe(true);
    await expect(fs.stat(path.join(orchHome, 'tasks'))).resolves.toBeTruthy();
  });

  it('cleans up sidecar when failure happens before worktree creation', async () => {
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
    ).toBe(true);
  });
});
