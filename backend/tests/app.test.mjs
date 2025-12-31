import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
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

async function createTestApp() {
  const orchHome = await createTempDir();
  const codexHome = await createTempDir();
  const exec = createMockExec({ branches: ['main'] });
  const spawn = createMockSpawn();
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome,
    exec,
    spawn,
    now: () => '2025-12-19T00:00:00.000Z'
  });
  return { app: createApp({ orchestrator }), exec, orchHome, spawn };
}

describe('API', () => {
  it('creates env and task via API', async () => {
    const { app } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
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

  it('uploads images and attaches them to new tasks', async () => {
    const { app, orchHome, spawn } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    const tempDir = await createTempDir();
    const imagePath = path.join(tempDir, 'sample.png');
    await fs.writeFile(imagePath, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));

    const uploadRes = await request(app)
      .post('/api/uploads')
      .attach('images', imagePath)
      .expect(201);

    const uploadedPath = uploadRes.body.uploads[0].path;
    expect(uploadedPath.startsWith(path.join(orchHome, 'uploads'))).toBe(true);

    const taskRes = await request(app)
      .post('/api/tasks')
      .send({ envId: envRes.body.envId, ref: 'main', prompt: 'Do work', imagePaths: [uploadedPath] })
      .expect(201);

    expect(taskRes.body.status).toBe('running');
    expect(spawn.calls[0].args).toContain('--image');
    expect(spawn.calls[0].args).toContain(uploadedPath);
    expect(spawn.calls[0].options.env.CODEX_MOUNT_PATHS).toContain(uploadedPath);
  });

  it('attaches context repos to tasks', async () => {
    const { app, spawn } = await createTestApp();

    const primaryEnvRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);
    const contextEnvRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:context.git', defaultBranch: 'main' })
      .expect(201);

    const taskRes = await request(app)
      .post('/api/tasks')
      .send({
        envId: primaryEnvRes.body.envId,
        ref: 'main',
        prompt: 'Do work',
        contextRepos: [{ envId: contextEnvRes.body.envId, ref: 'main' }]
      })
      .expect(201);

    expect(taskRes.body.contextRepos).toHaveLength(1);
    expect(taskRes.body.contextRepos[0].envId).toBe(contextEnvRes.body.envId);
    expect(taskRes.body.contextRepos[0].worktreePath).toBeTruthy();

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall.options.env.CODEX_MOUNT_PATHS_RO).toContain(
      taskRes.body.contextRepos[0].worktreePath
    );
  });

  it('rejects tasks with invalid image paths', async () => {
    const { app } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    await request(app)
      .post('/api/tasks')
      .send({ envId: envRes.body.envId, ref: 'main', prompt: 'Do work', imagePaths: ['/tmp/nope.png'] })
      .expect(400);
  });
});
