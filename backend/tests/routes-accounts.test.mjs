import { describe, expect, it } from 'vitest';
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

describe('accounts routes', () => {
  it('returns 400 when rate limits are requested without an active account', async () => {
    const app = await createTestApp();
    await request(app).get('/api/accounts/rate-limits').expect(400);
  });

  it('rejects missing or invalid authJson', async () => {
    const app = await createTestApp();
    await request(app).post('/api/accounts').send({ label: 'Primary' }).expect(400);
    await request(app).post('/api/accounts').send({ label: 'Primary', authJson: '{' }).expect(400);
  });

  it('prevents deleting the active account', async () => {
    const app = await createTestApp();
    const accountRes = await request(app)
      .post('/api/accounts')
      .send({ label: 'Primary', authJson: '{}' })
      .expect(201);

    await request(app).delete(`/api/accounts/${accountRes.body.id}`).expect(400);
  });

  it('supports activating, rotating, and deleting inactive accounts', async () => {
    const app = await createTestApp();
    await request(app)
      .post('/api/accounts')
      .send({ label: 'Primary', authJson: '{}' })
      .expect(201);
    const secondary = await request(app)
      .post('/api/accounts')
      .send({ label: 'Secondary', authJson: '{}' })
      .expect(201);

    await request(app).post(`/api/accounts/${secondary.body.id}/activate`).expect(200);
    await request(app).post('/api/accounts/rotate').expect(200);
    await request(app).delete(`/api/accounts/${secondary.body.id}`).expect(200);
  });

  it('updates account labels', async () => {
    const app = await createTestApp();
    const created = await request(app)
      .post('/api/accounts')
      .send({ label: 'Primary', authJson: '{}' })
      .expect(201);

    const updateRes = await request(app)
      .patch(`/api/accounts/${created.body.id}`)
      .send({ label: 'Renamed' })
      .expect(200);
    expect(updateRes.body.accounts[0].label).toBe('Renamed');
  });
});
