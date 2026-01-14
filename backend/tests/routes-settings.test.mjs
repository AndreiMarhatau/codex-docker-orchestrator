import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

async function createTestApp() {
  const orchHome = await createTempDir();
  const codexHome = await createTempDir();
  const orchestrator = new Orchestrator({ orchHome, codexHome });
  return { app: createApp({ orchestrator }) };
}

describe('settings password', () => {
  it('requires the password once set', async () => {
    const { app } = await createTestApp();

    const statusRes = await request(app).get('/api/settings/password').expect(200);
    expect(statusRes.body.hasPassword).toBe(false);

    await request(app).get('/api/envs').expect(200);

    await request(app)
      .post('/api/settings/password')
      .send({ password: 'secret-pass' })
      .expect(204);

    const updatedStatus = await request(app).get('/api/settings/password').expect(200);
    expect(updatedStatus.body.hasPassword).toBe(true);

    await request(app).get('/api/envs').expect(401);
    await request(app).get('/api/envs').set('X-Orch-Password', 'secret-pass').expect(200);

    await request(app).post('/api/settings/auth').send({ password: 'secret-pass' }).expect(204);
  });

  it('updates the password with the current password', async () => {
    const { app } = await createTestApp();

    await request(app)
      .post('/api/settings/password')
      .send({ password: 'first-pass' })
      .expect(204);

    await request(app)
      .post('/api/settings/password')
      .send({ password: 'next-pass', currentPassword: 'wrong' })
      .expect(401);

    await request(app)
      .post('/api/settings/password')
      .send({ password: 'next-pass', currentPassword: 'first-pass' })
      .expect(204);

    await request(app).get('/api/envs').set('X-Orch-Password', 'first-pass').expect(401);
    await request(app).get('/api/envs').set('X-Orch-Password', 'next-pass').expect(200);
  });
});
