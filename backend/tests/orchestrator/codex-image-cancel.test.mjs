import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Codex image readiness cancellation', () => {
  it('honors an already-aborted signal even when the image is cached ready', async () => {
    const orchHome = await createTempDir();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec: createMockExec({ branches: ['main'] }),
      spawn: createMockSpawn(),
      imageName: 'codex-image:latest'
    });
    orchestrator.markCodexImageReady({
      imageId: 'sha256:cached',
      createdAt: '2026-05-06T00:00:00.000Z'
    });
    const controller = new AbortController();
    controller.abort();

    await expect(orchestrator.ensureCodexImageReady({
      signal: controller.signal
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
