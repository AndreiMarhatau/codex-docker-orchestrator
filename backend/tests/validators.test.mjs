import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeContextReposInput, isSupportedImageFile } = require('../src/app/validators');

describe('validators', () => {
  it('normalizes context repo input', () => {
    expect(normalizeContextReposInput(undefined)).toBe(null);
    expect(() => normalizeContextReposInput('bad')).toThrow(/contextRepos/);
    expect(() => normalizeContextReposInput([{}])).toThrow(/envId/);
    expect(normalizeContextReposInput([{ envId: 'env-1', ref: 'main' }])).toEqual([
      { envId: 'env-1', ref: 'main' }
    ]);
  });

  it('validates supported image types', () => {
    expect(isSupportedImageFile({ mimetype: 'image/png', originalname: 'a.bin' })).toBe(true);
    expect(isSupportedImageFile({ mimetype: 'application/octet-stream', originalname: 'a.jpg' })).toBe(true);
    expect(isSupportedImageFile({ mimetype: 'text/plain', originalname: 'a.txt' })).toBe(false);
  });
});
