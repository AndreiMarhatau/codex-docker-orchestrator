import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createManualAppServerSpawn, createMockExec, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const fsp = require('node:fs/promises');
const { Orchestrator } = require('../../src/orchestrator');

function createDeferred() {
  let resolve = null;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createManualRunSpawn() {
  return createManualAppServerSpawn();
}

async function waitForValue(readValue) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const value = await readValue();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for value');
}

async function readTaskMeta(orchestrator, taskId) {
  const metaPath = path.join(orchestrator.orchHome, 'tasks', taskId, 'meta.json');
  return JSON.parse(await fsp.readFile(metaPath, 'utf8'));
}

async function createRunningTask(orchestrator) {
  const env = await orchestrator.createEnv({
    repoUrl: 'git@example.com:repo.git',
    defaultBranch: 'main'
  });
  return orchestrator.createTask({
    envId: env.envId,
    ref: 'main',
    prompt: 'Do work',
    useHostDockerSocket: true
  });
}

async function waitForRunServer(spawn) {
  const server = await waitForValue(() => spawn.latestServer());
  await server.waitForTurnStart();
  return server;
}

describe('Orchestrator finalization transitions', () => {
  it('keeps new resume transitions busy until finalization cleanup releases', async () => {
    const orchHome = await createTempDir();
    const spawn = createManualRunSpawn();
    const cleanupStarted = createDeferred();
    const releaseCleanup = createDeferred();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    orchestrator.stopTaskDockerSidecar = async () => {
      cleanupStarted.resolve();
      await releaseCleanup.promise;
    };

    const task = await createRunningTask(orchestrator);
    const server = await waitForRunServer(spawn);
    server.completeTurn();
    await cleanupStarted.promise;
    expect((await readTaskMeta(orchestrator, task.taskId)).status).toBe('completed');

    await expect(orchestrator.resumeTask(task.taskId, 'Again')).rejects.toMatchObject({
      code: 'TASK_BUSY'
    });

    releaseCleanup.resolve();
    await waitForValue(() => !orchestrator.getFinalizingTaskRun(task.taskId));
    const resumed = await orchestrator.resumeTask(task.taskId, 'Again');
    expect(resumed.status).toBe('running');
    expect(resumed.runs).toHaveLength(2);
  });

  it('preserves a stop requested while finalization is listing artifacts', async () => {
    const orchHome = await createTempDir();
    const spawn = createManualRunSpawn();
    const artifactReadStarted = createDeferred();
    const releaseArtifactRead = createDeferred();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn
    });
    let readdirSpy = null;

    try {
      const task = await createRunningTask(orchestrator);
      const server = await waitForRunServer(spawn);
      const originalReaddir = fsp.readdir.bind(fsp);
      readdirSpy = vi.spyOn(fsp, 'readdir').mockImplementationOnce(async (...args) => {
        artifactReadStarted.resolve();
        await releaseArtifactRead.promise;
        return originalReaddir(...args);
      });
      server.completeTurn();
      await artifactReadStarted.promise;

      const stopped = await orchestrator.stopTask(task.taskId);
      releaseArtifactRead.resolve();
      await waitForValue(async () => !orchestrator.getFinalizingTaskRun(task.taskId));
      const persisted = await readTaskMeta(orchestrator, task.taskId);

      expect(stopped.status).toBe('stopped');
      expect(persisted.status).toBe('stopped');
      expect(persisted.error).toBe('Stopped by user.');
    } finally {
      readdirSpy?.mockRestore();
    }
  });
});
