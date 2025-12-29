import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { serveArtifact } = require('../src/app/routes/task-artifacts');

function buildApp(orchestrator) {
  const app = express();
  app.get('/api/tasks/:taskId/artifacts/:runId/*', async (req, res) => {
    await serveArtifact(orchestrator, req, res);
  });
  return app;
}

describe('task artifacts route', () => {
  it('serves artifact files', async () => {
    const root = await createTempDir();
    const runId = 'run-001';
    const artifactsDir = path.join(root, runId);
    await fs.mkdir(artifactsDir, { recursive: true });
    const filename = 'sample.png';
    const filePath = path.join(artifactsDir, filename);
    const contents = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    await fs.writeFile(filePath, contents);

    const orchestrator = {
      getTaskMeta: async () => ({ runs: [{ runId }] }),
      runArtifactsDir: () => artifactsDir
    };
    const app = buildApp(orchestrator);

    const res = await request(app)
      .get(`/api/tasks/task-1/artifacts/${runId}/${filename}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body).toEqual(contents);
  });

  it('rejects invalid artifact paths', async () => {
    const root = await createTempDir();
    const runId = 'run-001';
    const artifactsDir = path.join(root, runId);
    await fs.mkdir(artifactsDir, { recursive: true });

    const orchestrator = {
      getTaskMeta: async () => ({ runs: [{ runId }] }),
      runArtifactsDir: () => artifactsDir
    };
    const app = buildApp(orchestrator);

    await request(app)
      .get(`/api/tasks/task-1/artifacts/${runId}/../secrets.txt`)
      .expect(400);
  });
});
