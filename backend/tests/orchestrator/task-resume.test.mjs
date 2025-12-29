import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator resume', () => {
  it('rejects resume when thread id is missing', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({ orchHome, exec: createMockExec() });
    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({ taskId: 'task-1', threadId: null })
    );

    await expect(orchestrator.resumeTask('task-1', 'hi')).rejects.toThrow(/thread_id/);
  });

  it('overrides docker socket usage on resume', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({ orchHome, exec, spawn });

    const envDir = path.join(orchHome, 'envs', 'env-1');
    await fs.mkdir(envDir, { recursive: true });
    await fs.writeFile(path.join(envDir, 'repo.url'), 'git@example.com:repo.git');
    await fs.writeFile(path.join(envDir, 'default_branch'), 'main');

    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
    const meta = {
      taskId: 'task-1',
      envId: 'env-1',
      threadId: 'thread-1',
      worktreePath: path.join(taskDir, 'worktree'),
      branchName: 'codex/task-1',
      model: 'gpt-5.2-codex',
      reasoningEffort: 'medium',
      useHostDockerSocket: true,
      runs: [
        {
          runId: 'run-001',
          prompt: 'start',
          logFile: 'run-001.jsonl',
          startedAt: 'now',
          status: 'completed'
        }
      ]
    };
    await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta));

    await orchestrator.resumeTask('task-1', 'Continue', { useHostDockerSocket: false });
    const updated = JSON.parse(await fs.readFile(path.join(taskDir, 'meta.json'), 'utf8'));
    expect(updated.useHostDockerSocket).toBe(false);
  });
});
