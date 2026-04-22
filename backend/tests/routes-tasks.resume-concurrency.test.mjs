import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir, prepareOrchestratorSetup } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function createTestContext() {
  const orchHome = await createTempDir();
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome: `${orchHome}/codex-home`,
    exec: createMockExec({ branches: ['main'] }),
    spawn: createMockSpawn()
  });
  await prepareOrchestratorSetup(orchestrator);
  return { app: await createApp({ orchestrator }), orchestrator };
}

async function waitForTaskStatus(orchestrator, taskId, status) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const task = await orchestrator.getTask(taskId);
    if (task.status === status) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${status}`);
}

async function createUploadInfo(orchestrator, name, contents = name) {
  const uploadPath = path.join(orchestrator.uploadsDir(), `${Date.now()}-${name}`);
  await fs.mkdir(orchestrator.uploadsDir(), { recursive: true });
  await fs.writeFile(uploadPath, contents);
  return {
    path: uploadPath,
    originalName: name,
    size: Buffer.byteLength(contents),
    mimeType: 'text/plain'
  };
}

describe('tasks resume route concurrency', () => {
  it('rejects a concurrent resume before the losing request stages uploads or starts a duplicate run', async () => {
    const { app, orchestrator } = await createTestContext();
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const authStarted = createDeferred();
    const releaseAuth = createDeferred();
    const startedRuns = [];
    const originalStartCodexRunDeferred = orchestrator.startCodexRunDeferred.bind(orchestrator);
    let ensureActiveAuthCalls = 0;
    orchestrator.startCodexRunDeferred = (options) => {
      startedRuns.push(options);
      return originalStartCodexRunDeferred(options);
    };
    orchestrator.ensureActiveAuth = async () => {
      ensureActiveAuthCalls += 1;
      authStarted.resolve();
      await releaseAuth.promise;
    };

    const firstResumePromise = request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({ prompt: 'Continue' })
      .then((response) => response);
    await authStarted.promise;

    const blockedUpload = await createUploadInfo(orchestrator, 'blocked.txt', 'blocked upload');
    const secondResponse = await request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({ prompt: 'Concurrent continue', fileUploads: [blockedUpload] })
      .expect(409);

    releaseAuth.resolve();
    const firstResponse = await firstResumePromise;

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.text).toContain('Wait for the current run to finish');
    expect(startedRuns).toHaveLength(1);
    expect(ensureActiveAuthCalls).toBe(1);
    await expect(fs.access(blockedUpload.path)).resolves.toBeUndefined();

    const updated = await orchestrator.getTask(task.taskId);
    expect(updated.runs).toHaveLength(2);
  });
});
