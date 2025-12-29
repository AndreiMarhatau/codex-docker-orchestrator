import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('orchestrator images', () => {
  it('reports missing images', async () => {
    const exec = createMockExec({ dockerImageExists: false });
    const orchestrator = new Orchestrator({ exec });
    const info = await orchestrator.getImageInfo();
    expect(info.present).toBe(false);
    expect(info.imageId).toBe(null);
  });
});
