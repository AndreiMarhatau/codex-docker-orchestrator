import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskIdle, waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator task context resume', () => {
  it('replaces context repos on resume when provided', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

    const primaryEnv = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const contextEnvA = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context-a.git',
      defaultBranch: 'main'
    });
    const contextEnvB = await orchestrator.createEnv({
      repoUrl: 'git@example.com:context-b.git',
      defaultBranch: 'main'
    });

    const task = await orchestrator.createTask({
      envId: primaryEnv.envId,
      ref: 'main',
      prompt: 'Do work',
      contextRepos: [{ envId: contextEnvA.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    await waitForTaskIdle(orchestrator, task.taskId);

    const contextPathA = orchestrator.taskContextWorktree(
      task.taskId,
      contextEnvA.repoUrl,
      contextEnvA.envId
    );
    await orchestrator.resumeTask(task.taskId, 'Continue', {
      contextRepos: [{ envId: contextEnvB.envId, ref: 'main' }]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const resumeCall = spawn.calls.filter((call) => call.command === 'codex-docker')[1];
    const volumeMounts = resumeCall.options?.env?.CODEX_VOLUME_MOUNTS || '';
    expect(volumeMounts).toContain('=/readonly/context-b:ro');
    expect(volumeMounts).not.toContain(contextPathA);
    await expect(fs.stat(contextPathA)).rejects.toThrow();

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.contextRepos).toHaveLength(1);
    expect(meta.contextRepos[0].envId).toBe(contextEnvB.envId);
  });
});
