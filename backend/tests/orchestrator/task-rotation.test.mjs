import { describe, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator rotation guards', () => {
  it('skips rotation when prompt is missing or run succeeded', async () => {
    const orchestrator = new Orchestrator({ exec: async () => ({ stdout: '', stderr: '', code: 0 }) });
    await orchestrator.maybeAutoRotate('task-1', '', { code: 1, stopped: false, stdout: '' });
    await orchestrator.maybeAutoRotate('task-1', 'hi', { code: 0, stopped: false, stdout: '' });
  });

  it('skips rotation when usage limit is not detected', async () => {
    const orchestrator = new Orchestrator({ exec: async () => ({ stdout: '', stderr: '', code: 0 }) });
    await orchestrator.maybeAutoRotate('task-1', 'hi', { code: 1, stopped: false, stdout: 'ok' });
  });

  it('skips rotation when thread id is missing', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({ orchHome, exec: async () => ({ stdout: '', stderr: '', code: 0 }) });
    const taskDir = path.join(orchHome, 'tasks', 'task-1');
    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(
      path.join(taskDir, 'meta.json'),
      JSON.stringify({ taskId: 'task-1', threadId: null, runs: [] })
    );

    await orchestrator.maybeAutoRotate('task-1', 'hi', { code: 1, stopped: false, stdout: '', usageLimit: true });
  });
});
