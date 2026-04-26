import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function buildStaleRunningMeta(taskId, overrides = {}) {
  return {
    taskId,
    envId: 'env-1',
    repoUrl: 'git@example.com:repo.git',
    branchName: `codex/${taskId}`,
    worktreePath: null,
    status: 'running',
    error: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    useHostDockerSocket: true,
    runs: [
      {
        runId: 'run-001',
        prompt: 'Do work',
        logFile: 'run-001.jsonl',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: null,
        status: 'running',
        exitCode: null
      }
    ],
    ...overrides
  };
}

async function writeTaskMeta(orchHome, meta) {
  const taskDir = path.join(orchHome, 'tasks', meta.taskId);
  await fs.mkdir(path.join(taskDir, 'logs'), { recursive: true });
  await fs.writeFile(path.join(taskDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

async function readTaskMeta(orchHome, taskId) {
  return JSON.parse(await fs.readFile(path.join(orchHome, 'tasks', taskId, 'meta.json'), 'utf8'));
}

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function withTimeout(promise, timeoutMs = 1000) {
  let timeout = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timed out waiting for operation')), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function waitForValue(readValue) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    const value = await readValue();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for value');
}

describe('Orchestrator stale Docker runtime cleanup', () => {
  it('waits for stale sidecar cleanup before resuming a Docker-backed run', async () => {
    const orchHome = await createTempDir();
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const taskId = 'task-docker-resume';
    const worktreePath = path.join(orchHome, 'tasks', taskId, 'repo');
    const cleanupStarted = createDeferred();
    const releaseCleanup = createDeferred();
    let cleanupFinished = false;
    orchestrator.stopTaskDockerSidecar = async () => {
      cleanupStarted.resolve();
      await releaseCleanup.promise;
      cleanupFinished = true;
    };
    await fs.mkdir(worktreePath, { recursive: true });
    await writeTaskMeta(orchHome, buildStaleRunningMeta(taskId, {
      envId: env.envId,
      repoUrl: env.repoUrl,
      branchName: `codex/${taskId}`,
      worktreePath,
      threadId: 'thread-1'
    }));

    const resumePromise = orchestrator.resumeTask(taskId, 'Continue', {
      useHostDockerSocket: true
    });
    await withTimeout(cleanupStarted.promise);
    const beforeCleanupRelease = await readTaskMeta(orchHome, taskId);

    expect(beforeCleanupRelease.status).toBe('stopped');
    expect(beforeCleanupRelease.runs).toHaveLength(1);
    expect(spawn.calls.some((call) => call.command === 'codex-docker')).toBe(false);

    releaseCleanup.resolve();
    const resumed = await withTimeout(resumePromise);
    await waitForValue(() => spawn.calls.some((call) => call.command === 'codex-docker'));

    expect(cleanupFinished).toBe(true);
    expect(resumed.status).toBe('running');
    expect(resumed.runs).toHaveLength(2);
  });

  it('cancels a pending Docker-backed resume waiting for stale cleanup', async () => {
    const orchHome = await createTempDir();
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const taskId = 'task-docker-resume-stop';
    const worktreePath = path.join(orchHome, 'tasks', taskId, 'repo');
    const cleanupStarted = createDeferred();
    const releaseCleanup = createDeferred();
    orchestrator.stopTaskDockerSidecar = async () => {
      cleanupStarted.resolve();
      await releaseCleanup.promise;
    };
    await fs.mkdir(worktreePath, { recursive: true });
    await writeTaskMeta(orchHome, buildStaleRunningMeta(taskId, {
      envId: env.envId,
      repoUrl: env.repoUrl,
      branchName: `codex/${taskId}`,
      worktreePath,
      threadId: 'thread-1'
    }));

    const resumePromise = orchestrator.resumeTask(taskId, 'Continue', {
      useHostDockerSocket: true
    });
    await withTimeout(cleanupStarted.promise);

    const stopped = await orchestrator.stopTask(taskId);
    releaseCleanup.resolve();
    const resumed = await withTimeout(resumePromise);
    await new Promise((resolve) => setImmediate(resolve));
    const persisted = await readTaskMeta(orchHome, taskId);

    expect(stopped.status).toBe('stopped');
    expect(resumed.status).toBe('stopped');
    expect(persisted.status).toBe('stopped');
    expect(persisted.runs).toHaveLength(1);
    expect(spawn.calls.some((call) => call.command === 'codex-docker')).toBe(false);
  });
});
