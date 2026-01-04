import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createMockExec, createMockSpawn, createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

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
  return { app: createApp({ orchestrator }), spawn };
}

describe('API task context and attachments', () => {
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

  it('adds and removes task attachments', async () => {
    const { app } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    const taskRes = await request(app)
      .post('/api/tasks')
      .send({ envId: envRes.body.envId, ref: 'main', prompt: 'Do work' })
      .expect(201);

    const tempDir = await createTempDir();
    const textPath = path.join(tempDir, 'resume.txt');
    await fs.writeFile(textPath, 'hello');

    const attachRes = await request(app)
      .post(`/api/tasks/${taskRes.body.taskId}/attachments`)
      .attach('files', textPath)
      .expect(201);

    expect(attachRes.body.attachments).toHaveLength(1);

    const attachmentName = attachRes.body.attachments[0].name;
    const removeRes = await request(app)
      .delete(`/api/tasks/${taskRes.body.taskId}/attachments`)
      .send({ names: [attachmentName] })
      .expect(200);

    expect(removeRes.body.attachments).toHaveLength(0);
  });
});
