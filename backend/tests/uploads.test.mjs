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
  const orchestrator = new Orchestrator({ orchHome, codexHome, exec, spawn });
  return createApp({ orchestrator });
}

describe('uploads route', () => {
  it('rejects requests without files', async () => {
    const app = await createTestApp();
    await request(app).post('/api/uploads').expect(400);
    await request(app).post('/api/uploads/files').expect(400);
  });

  it('rejects unsupported file types', async () => {
    const app = await createTestApp();
    const tempDir = await createTempDir();
    const textPath = path.join(tempDir, 'note.txt');
    await fs.writeFile(textPath, 'hello');

    await request(app)
      .post('/api/uploads')
      .attach('images', textPath)
      .expect(400);
  });

  it('accepts non-image files for task uploads', async () => {
    const app = await createTestApp();
    const tempDir = await createTempDir();
    const textPath = path.join(tempDir, 'note.txt');
    await fs.writeFile(textPath, 'hello');

    const res = await request(app)
      .post('/api/uploads/files')
      .attach('files', textPath)
      .expect(201);

    expect(res.body.uploads[0].originalName).toBe('note.txt');
  });
});
