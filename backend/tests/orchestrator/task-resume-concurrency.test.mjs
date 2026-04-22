import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('orchestrator resume concurrency', () => {
  it('serializes concurrent resumeTask calls for the same task', async () => {
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
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({
        taskId: 'task-1',
        envId: 'env-1',
        threadId: 'thread-1',
        worktreePath: path.join(taskDir, 'worktree'),
        branchName: 'codex/task-1',
        model: 'gpt-5.2-codex',
        reasoningEffort: 'medium',
        status: 'completed',
        runs: [{ runId: 'run-001', prompt: 'start', logFile: 'run-001.jsonl', startedAt: 'now', status: 'completed' }]
      })
    );

    const authStarted = createDeferred();
    const releaseAuth = createDeferred();
    const startedRuns = [];
    const originalStartCodexRunDeferred = orchestrator.startCodexRunDeferred.bind(orchestrator);
    orchestrator.startCodexRunDeferred = (options) => {
      startedRuns.push(options);
      return originalStartCodexRunDeferred(options);
    };
    orchestrator.ensureActiveAuth = async () => {
      authStarted.resolve();
      await releaseAuth.promise;
    };

    const firstResumePromise = orchestrator.resumeTask('task-1', 'Continue');
    await authStarted.promise;
    await expect(orchestrator.resumeTask('task-1', 'Concurrent continue')).rejects.toThrow(
      /Wait for the current run to finish/
    );
    releaseAuth.resolve();

    await expect(firstResumePromise).resolves.toEqual(
      expect.objectContaining({ taskId: 'task-1', status: 'running' })
    );
    expect(startedRuns).toHaveLength(1);
  });
});
