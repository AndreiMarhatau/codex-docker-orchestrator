import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { listArtifacts } = require('../../src/orchestrator/artifacts');

describe('orchestrator artifacts', () => {
  it('returns empty list when directory is missing', async () => {
    const results = await listArtifacts(path.join(await createTempDir(), 'missing'));
    expect(results).toEqual([]);
  });

  it('lists nested artifact files', async () => {
    const root = await createTempDir();
    const nestedDir = path.join(root, 'nested');
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(root, 'a.txt'), 'a');
    await fs.writeFile(path.join(nestedDir, 'b.txt'), 'b');

    const artifacts = await listArtifacts(root);
    expect(artifacts.map((item) => item.path)).toEqual(['a.txt', 'nested/b.txt']);
  });
});
