import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

async function waitForTaskCompletion(app, taskId) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/tasks/${taskId}`).expect(200);
    if (res.body.status === 'completed') {
      return res.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for task completion');
}

async function createTestApp({ branches } = {}) {
  const orchHome = await createTempDir();
  const codexHome = await createTempDir();
  const exec = createMockExec({ branches: branches || ['main'] });
  const spawn = createMockSpawn();
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome,
    exec,
    spawn,
    now: () => '2025-12-19T00:00:00.000Z'
  });
  return { app: createApp({ orchestrator }), exec, orchHome, orchestrator, spawn };
}

describe('API', () => {
  it('creates env and task via API', async () => {
    const { app, spawn } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({
        repoUrl: 'git@example.com:repo.git',
        defaultBranch: 'main',
        envVars: { SAMPLE_FLAG: 'alpha=bravo', SECRET_TOKEN: 't0ken!@#$' }
      })
      .expect(201);

    const envId = envRes.body.envId;
    expect(envId).toBeTruthy();

    const taskRes = await request(app)
      .post('/api/tasks')
      .send({
        envId,
        ref: 'main',
        prompt: 'Do work',
        model: 'gpt-5.1-codex-max',
        reasoningEffort: 'high'
      })
      .expect(201);

    expect(taskRes.body.status).toBe('running');
    expect(taskRes.body.model).toBe('gpt-5.1-codex-max');
    expect(taskRes.body.reasoningEffort).toBe('high');

    const diffRes = await request(app).get(`/api/tasks/${taskRes.body.taskId}/diff`).expect(200);
    expect(diffRes.body.available).toBe(true);
    expect(diffRes.body.baseSha).toBeTruthy();
    expect(diffRes.body.files.length).toBeGreaterThanOrEqual(0);

    const listRes = await request(app).get('/api/tasks').expect(200);
    expect(listRes.body).toHaveLength(1);

    const completed = await waitForTaskCompletion(app, taskRes.body.taskId);
    expect(completed.threadId).toBeTruthy();
    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall.options.env.SAMPLE_FLAG).toBe('alpha=bravo');
    expect(runCall.options.env.SECRET_TOKEN).toBe('t0ken!@#$');
  });

  it('updates env defaults via API', async () => {
    const { app } = await createTestApp({ branches: ['main', 'develop'] });

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    const updateRes = await request(app)
      .patch(`/api/envs/${envRes.body.envId}`)
      .send({ defaultBranch: 'develop', envVars: { FEATURE_FLAG: 'true' } })
      .expect(200);

    expect(updateRes.body.defaultBranch).toBe('develop');
    expect(updateRes.body.envVars).toEqual({ FEATURE_FLAG: 'true' });
  });

  it('updates env vars without changing the base branch', async () => {
    const { app } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    const updateRes = await request(app)
      .patch(`/api/envs/${envRes.body.envId}`)
      .send({ envVars: { SAMPLE: '1' } })
      .expect(200);

    expect(updateRes.body.defaultBranch).toBe('main');
    expect(updateRes.body.envVars).toEqual({ SAMPLE: '1' });
  });

  it('rejects empty env updates', async () => {
    const { app } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    await request(app)
      .patch(`/api/envs/${envRes.body.envId}`)
      .send({})
      .expect(400);
  });

  it('returns 404 for missing task', async () => {
    const { app } = await createTestApp();
    await request(app).get('/api/tasks/missing').expect(404);
  });

  it('returns account rate limits for the active account', async () => {
    const { app } = await createTestApp();

    const accountRes = await request(app)
      .post('/api/accounts')
      .send({ label: 'Primary', authJson: '{}' })
      .expect(201);

    const rateRes = await request(app).get('/api/accounts/rate-limits').expect(200);
    expect(rateRes.body.account.id).toBe(accountRes.body.id);
    expect(rateRes.body.rateLimits.primary.usedPercent).toBe(25);
    expect(rateRes.body.rateLimits.primary.windowDurationMins).toBe(15);
    expect(rateRes.body.rateLimits.primary.resetsAt).toBe(1730947200);
    expect(rateRes.body.fetchedAt).toBeTruthy();
  });

  it('isolates state-event listener failures from mutations', async () => {
    const { orchestrator } = await createTestApp();
    orchestrator.subscribeStateEvents(() => {
      throw new Error('listener failed');
    });
    expect(() => {
      orchestrator.emitStateEvent('tasks_changed', { taskId: 'task-1' });
    }).not.toThrow();
  });
});
