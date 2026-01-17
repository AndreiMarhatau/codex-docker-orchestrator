import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizeAttachmentUploadsInput,
  normalizeContextReposInput,
  normalizeEnvVarsInput,
  isSupportedImageFile
} = require('../src/app/validators');

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

  it('normalizes attachment uploads input', () => {
    expect(normalizeAttachmentUploadsInput(undefined)).toBe(null);
    expect(() => normalizeAttachmentUploadsInput('bad')).toThrow(/fileUploads/);
    expect(() => normalizeAttachmentUploadsInput([{}])).toThrow(/path/);
    expect(
      normalizeAttachmentUploadsInput([
        { path: '/tmp/file.txt', originalName: 'file.txt', size: 10, mimeType: 'text/plain' }
      ])
    ).toEqual([
      { path: '/tmp/file.txt', originalName: 'file.txt', size: 10, mimeType: 'text/plain' }
    ]);
  });

  it('normalizes env vars input', () => {
    expect(normalizeEnvVarsInput(undefined)).toBe(null);
    expect(() => normalizeEnvVarsInput('bad')).toThrow(/envVars/);
    expect(() => normalizeEnvVarsInput({ '1BAD': 'nope' })).toThrow(/invalid/);
    expect(normalizeEnvVarsInput({ OK: 'yes', TOKEN: 123 })).toEqual({ OK: 'yes', TOKEN: '123' });
    expect(
      normalizeEnvVarsInput([{ key: 'FOO', value: 'bar=baz' }, { key: 'ALPHA', value: '1' }])
    ).toEqual({ FOO: 'bar=baz', ALPHA: '1' });
  });
});
