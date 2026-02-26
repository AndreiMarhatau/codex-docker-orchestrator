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
  return { app: createApp({ orchestrator }), orchHome, spawn };
}

describe('API uploads', () => {
  it('uploads files and attaches them to new tasks', async () => {
    const { app, orchHome, spawn } = await createTestApp();

    const envRes = await request(app)
      .post('/api/envs')
      .send({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' })
      .expect(201);

    const tempDir = await createTempDir();
    const textPath = path.join(tempDir, 'note.txt');
    await fs.writeFile(textPath, 'hello');

    const uploadRes = await request(app).post('/api/uploads/files').attach('files', textPath).expect(201);
    const uploadInfo = uploadRes.body.uploads[0];
    const taskRes = await request(app)
      .post('/api/tasks')
      .send({
        envId: envRes.body.envId,
        ref: 'main',
        prompt: 'Do work',
        fileUploads: [uploadInfo]
      })
      .expect(201);

    expect(taskRes.body.attachments).toHaveLength(1);
    const attachmentPath = taskRes.body.attachments[0].path;
    const attachmentsDir = path.join(orchHome, 'tasks', taskRes.body.taskId, 'attachments');
    expect(attachmentPath.startsWith(attachmentsDir)).toBe(true);

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    expect(runCall.args).not.toContain('--image');
    expect(runCall.options.env.CODEX_MOUNT_PATHS_RO).toBeUndefined();
    expect(runCall.options.env.CODEX_MOUNT_MAPS_RO).toContain(`${attachmentsDir}=/attachments`);
  });
});
