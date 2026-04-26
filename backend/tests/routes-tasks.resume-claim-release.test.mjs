import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir, prepareOrchestratorSetup } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

function createControlledRunSpawn() {
  const baseSpawn = createMockSpawn();
  let runChild = null;
  const spawn = (command, args, options = {}) => {
    if (command !== 'codex-docker' || args[0] === 'app-server') {
      return baseSpawn(command, args, options);
    }
    spawn.calls.push({ command, args, options });
    runChild = new EventEmitter();
    runChild.stdout = new PassThrough();
    runChild.stderr = new PassThrough();
    runChild.stdin = new PassThrough();
    runChild.kill = () => {};
    return runChild;
  };
  spawn.calls = baseSpawn.calls;
  spawn.finishRun = () => {
    const started = { type: 'thread.started', thread_id: baseSpawn.threadId };
    runChild.stdout.write(`${JSON.stringify(started)}\n`);
    runChild.emit('close', 0, null);
  };
  return spawn;
}

async function createTestContext({ spawn = createMockSpawn() } = {}) {
  const orchHome = await createTempDir();
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome: `${orchHome}/codex-home`,
    exec: createMockExec({ branches: ['main'] }),
    spawn
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

describe('tasks resume claim release', () => {
  it('releases the transition claim after repeated missing-task 404 responses', async () => {
    const { app, orchestrator } = await createTestContext();

    await request(app)
      .post('/api/tasks/missing/resume')
      .send({ prompt: 'Continue' })
      .expect(404);
    expect(orchestrator.taskRunClaims?.size || 0).toBe(0);

    await request(app)
      .post('/api/tasks/missing/resume')
      .send({ prompt: 'Continue again' })
      .expect(404);
    expect(orchestrator.taskRunClaims?.size || 0).toBe(0);
  });

  it('releases the transition claim after a running-task 409 response', async () => {
    const spawn = createControlledRunSpawn();
    const { app, orchestrator } = await createTestContext({ spawn });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const blockedResponse = await request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({ prompt: 'Continue' })
      .expect(409);

    expect(blockedResponse.text).toContain('Wait for the current run to finish');
    expect(orchestrator.taskRunClaims?.size || 0).toBe(0);

    spawn.finishRun();
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    const resumedResponse = await request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({ prompt: 'Continue for real' })
      .expect(200);

    expect(resumedResponse.body).toEqual(expect.objectContaining({ taskId: task.taskId }));
    expect(orchestrator.taskRunClaims?.size || 0).toBe(0);
  });
});
