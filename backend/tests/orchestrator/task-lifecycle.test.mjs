import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator task lifecycle', () => {
  it('creates env and task, then resumes', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    expect(env.repoUrl).toBe('git@example.com:repo.git');

    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work',
      model: 'gpt-5.2-codex',
      reasoningEffort: 'medium'
    });
    expect(task.status).toBe('running');
    expect(task.branchName).toContain('codex/');
    expect(task.model).toBe('gpt-5.2-codex');
    expect(task.reasoningEffort).toBe('medium');

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.threadId).toBe(spawn.threadId);
    expect(completed.initialPrompt).toBe('Do work');

    const resumed = await orchestrator.resumeTask(task.taskId, 'Continue', {
      model: 'gpt-5.2-codex',
      reasoningEffort: 'xhigh'
    });
    expect(resumed.status).toBe('running');

    const resumedCompleted = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(resumed.runs).toHaveLength(2);
    expect(resumedCompleted.lastPrompt).toBe('Continue');
    expect(resumedCompleted.model).toBe('gpt-5.2-codex');
    expect(resumedCompleted.reasoningEffort).toBe('medium');

    const metaPath = path.join(orchHome, 'tasks', task.taskId, 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    expect(meta.runs).toHaveLength(2);
    expect(meta.runs[0].model).toBe('gpt-5.2-codex');
    expect(meta.runs[0].reasoningEffort).toBe('medium');
    expect(meta.runs[1].model).toBe('gpt-5.2-codex');
    expect(meta.runs[1].reasoningEffort).toBe('xhigh');
    expect(spawn.calls[0].args).toEqual(
      expect.arrayContaining(['--model', 'gpt-5.2-codex', '-c', 'model_reasoning_effort=medium'])
    );
    expect(spawn.calls[1].args).toEqual(
      expect.arrayContaining(['--model', 'gpt-5.2-codex', '-c', 'model_reasoning_effort=xhigh'])
    );
  });

  it('mounts mirror path for runs', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall).toBeTruthy();
    const mountRw = runCall.options?.env?.CODEX_MOUNT_PATHS || '';
    expect(mountRw.split(':')).toContain(orchestrator.mirrorDir(env.envId));
    expect(runCall.options?.env?.CODEX_MOUNT_PATHS_RO).toBeUndefined();
  });
});
