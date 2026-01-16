import { describe, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

async function createTestApp() {
  const orchHome = await createTempDir();
  const codexHome = await createTempDir();
  const exec = createMockExec({ branches: ['main'] });
  const spawn = createMockSpawn();
  const orchestrator = new Orchestrator({ orchHome, codexHome, exec, spawn });
  return createApp({ orchestrator });
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
  });
});
