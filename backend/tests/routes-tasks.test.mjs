import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir, prepareOrchestratorSetup } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

function createPendingTaskSpawn() {
  const baseSpawn = createMockSpawn();
  const spawn = (command, args, options = {}) => {
    if (command === 'codex-docker' && args[0] !== 'app-server') {
      spawn.calls.push({ command, args, options });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => {
        setImmediate(() => {
          child.emit('close', 143, 'SIGTERM');
        });
      };
      setImmediate(() => {
        child.stdout.write(
          'banner line\n' +
            JSON.stringify({ type: 'thread.started', thread_id: baseSpawn.threadId }) +
            '\n'
        );
      });
      return child;
    }
    return baseSpawn(command, args, options);
  };

  spawn.calls = baseSpawn.calls;
  spawn.threadId = baseSpawn.threadId;
  return spawn;
}

async function createTestContext({ spawn = createMockSpawn() } = {}) {
  const orchHome = await createTempDir();
  const codexHome = `${orchHome}/codex-home`;
  const exec = createMockExec({ branches: ['main'] });
  const orchestrator = new Orchestrator({ orchHome, codexHome, exec, spawn });
  await prepareOrchestratorSetup(orchestrator);
  return {
    app: await createApp({ orchestrator }),
    orchestrator
  };
}

async function createTestApp() {
  const { app } = await createTestContext();
  return app;
}

describe('tasks routes', () => {
  it('validates required task fields', async () => {
    const app = await createTestApp();
    await request(app).post('/api/tasks').send({ prompt: 'hi' }).expect(400);
    await request(app).post('/api/tasks').send({ envId: 'env' }).expect(400);
  });

  it('validates boolean flags and context repos', async () => {
    const app = await createTestApp();
    await request(app)
      .post('/api/tasks')
      .send({ envId: 'env', prompt: 'hi', useHostDockerSocket: 'yes' })
      .expect(400);

    await request(app)
      .post('/api/tasks')
      .send({ envId: 'env', prompt: 'hi', contextRepos: 'nope' })
      .expect(400);

    await request(app)
      .post('/api/tasks')
      .send({ envId: 'env', prompt: 'hi', contextRepos: [{}] })
      .expect(400);
  });

  it('validates resume request payloads', async () => {
    const app = await createTestApp();
    await request(app)
      .post('/api/tasks/task-1/resume')
      .send({})
      .expect(400);

    await request(app)
      .post('/api/tasks/task-1/resume')
      .send({ prompt: 'hi', useHostDockerSocket: 'no' })
      .expect(400);

    await request(app)
      .post('/api/tasks/task-1/resume')
      .send({ prompt: 'hi', fileUploads: 'bad' })
      .expect(400);

    await request(app)
      .post('/api/tasks/task-1/resume')
      .send({ prompt: 'hi', attachmentRemovals: [''] })
      .expect(400);
  });

  it('rejects resume requests while a task is already running', async () => {
    const { app, orchestrator } = await createTestContext({ spawn: createPendingTaskSpawn() });
    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const response = await request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({ prompt: 'Continue' })
      .expect(409);

    expect(response.text).toContain('Wait for the current run to finish');
  });

  it('returns 404 when resuming a missing task', async () => {
    const app = await createTestApp();

    await request(app)
      .post('/api/tasks/missing/resume')
      .send({ prompt: 'Continue' })
      .expect(404);
  });
});
