import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { LOST_RUNNER_ERROR, USER_STOPPED_ERROR } = require('../../src/domains/tasks/operations/runtime-state');
import {
  buildStaleRunningMeta,
  createDeferred,
  createOrchestrator,
  readTaskMeta,
  writeTaskMeta,
  withTimeout,
  NOW
} from './task-runtime-state-helpers.mjs';

describe('Orchestrator task runtime state reconciliation', () => {
  it('marks stale running tasks stopped during app startup and best-effort stops sidecars', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const orchestrator = createOrchestrator(orchHome, { exec });
    await writeTaskMeta(
      orchHome,
      buildStaleRunningMeta('task-startup', { useHostDockerSocket: true })
    );

    await orchestrator.initializeAppStartup();

    const persisted = await readTaskMeta(orchHome, 'task-startup');
    expect(persisted.status).toBe('stopped');
    expect(persisted.error).toBe(LOST_RUNNER_ERROR);
    expect(persisted.updatedAt).toBe(NOW);
    expect(persisted.runs[0].status).toBe('stopped');
    expect(persisted.runs[0].finishedAt).toBe(NOW);
    expect(
      exec.calls.some((call) => call.command === 'docker' && call.args[0] === 'stop')
    ).toBe(true);
  });

  it('reconciles stale running tasks when listed or loaded individually', async () => {
    const orchHome = await createTempDir();
    const orchestrator = createOrchestrator(orchHome, {
      exec: createMockExec({ branches: ['main'] })
    });
    await writeTaskMeta(orchHome, buildStaleRunningMeta('task-list'));
    await writeTaskMeta(orchHome, buildStaleRunningMeta('task-detail'));

    const tasks = await orchestrator.listTasks();
    const listed = tasks.find((task) => task.taskId === 'task-list');
    expect(listed.status).toBe('stopped');
    expect(listed.error).toBe(LOST_RUNNER_ERROR);

    const detail = await orchestrator.getTask('task-detail');
    expect(detail.status).toBe('stopped');
    expect(detail.error).toBe(LOST_RUNNER_ERROR);
    expect(detail.runLogs[0].status).toBe('stopped');
  });

  it('does not reconcile create metadata while the create transition is claimed', async () => {
    const orchHome = await createTempDir();
    const spawn = createMockSpawn();
    const orchestrator = createOrchestrator(orchHome, {
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const authPaused = createDeferred();
    const releaseAuth = createDeferred();
    orchestrator.ensureActiveAuth = async () => {
      authPaused.resolve();
      await releaseAuth.promise;
    };

    const createPromise = orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });
    await authPaused.promise;
    const [taskId] = await fs.readdir(path.join(orchHome, 'tasks'));

    const listed = (await orchestrator.listTasks()).find((task) => task.taskId === taskId);
    const detail = await orchestrator.getTask(taskId);
    expect(listed.status).toBe('running');
    expect(listed.error).toBeNull();
    expect(detail.status).toBe('running');
    expect(detail.error).toBeNull();

    const stopped = await orchestrator.stopTask(taskId);
    releaseAuth.resolve();
    const created = await createPromise;

    expect(stopped.status).toBe('stopped');
    expect(stopped.error).toBe(USER_STOPPED_ERROR);
    expect(created.status).toBe('stopped');
    expect(created.error).toBe(USER_STOPPED_ERROR);
    expect(spawn.calls.some((call) => call.command === 'codex-docker')).toBe(false);
  });

  it('persists reconciled stopped state before delayed sidecar cleanup resolves', async () => {
    const orchHome = await createTempDir();
    let cleanupStarted = false;
    const orchestrator = createOrchestrator(orchHome, {
      exec: createMockExec({ branches: ['main'] })
    });
    orchestrator.stopTaskDockerSidecar = async () => {
      cleanupStarted = true;
      return new Promise(() => {});
    };
    await writeTaskMeta(
      orchHome,
      buildStaleRunningMeta('task-cleanup', { useHostDockerSocket: true })
    );

    const tasks = await withTimeout(orchestrator.listTasks());
    const listed = tasks.find((task) => task.taskId === 'task-cleanup');
    const persisted = await readTaskMeta(orchHome, 'task-cleanup');

    expect(listed.status).toBe('stopped');
    expect(persisted.status).toBe('stopped');
    await Promise.resolve();
    expect(cleanupStarted).toBe(true);
  });
});
