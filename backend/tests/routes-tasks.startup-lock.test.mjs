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

async function createPausedTask({ orchestrator, env }) {
  const authStarted = createDeferred();
  const releaseAuth = createDeferred();
  orchestrator.ensureActiveAuth = async () => {
    authStarted.resolve();
    await releaseAuth.promise;
  };
  const createPromise = orchestrator.createTask({
    envId: env.envId,
    ref: 'main',
    prompt: 'Do work'
  });
  await authStarted.promise;
  const [taskId] = await fs.readdir(orchestrator.tasksDir());
  return { createPromise, releaseAuth, taskId };
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
  const app = await createApp({ orchestrator });
  const env = await orchestrator.createEnv({
    repoUrl: 'git@example.com:repo.git',
    defaultBranch: 'main'
  });
  return { app, env, orchestrator };
}

async function writeUploadFile(orchestrator) {
  const filePath = path.join(orchestrator.orchHome, 'upload-source.txt');
  await fs.writeFile(filePath, 'upload');
  return filePath;
}

describe('task startup mutation locking', () => {
  it('rejects task mutations while create startup is active', async () => {
    const { app, env, orchestrator } = await createTestContext();
    const { createPromise, releaseAuth, taskId } = await createPausedTask({ orchestrator, env });
    const uploadPath = await writeUploadFile(orchestrator);

    await request(app)
      .post(`/api/tasks/${taskId}/attachments`)
      .attach('files', uploadPath)
      .expect(409);
    await expect(fs.readdir(orchestrator.uploadsDir())).resolves.toHaveLength(0);
    await request(app)
      .delete(`/api/tasks/${taskId}/attachments`)
      .send({ names: ['existing.txt'] })
      .expect(409);
    await request(app)
      .post(`/api/tasks/${taskId}/resume`)
      .send({ prompt: 'Continue' })
      .expect(409);
    await request(app).post(`/api/tasks/${taskId}/push`).expect(409);
    await request(app)
      .post(`/api/tasks/${taskId}/commit-push`)
      .send({ message: 'Update task' })
      .expect(409);
    await request(app)
      .post(`/api/tasks/${taskId}/review`)
      .send({ type: 'uncommittedChanges' })
      .expect(409);
    await request(app).delete(`/api/tasks/${taskId}`).expect(409);

    releaseAuth.resolve();
    await createPromise;
    await waitForTaskStatus(orchestrator, taskId, 'completed');
  });
});
