import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizeAttachmentNamesInput,
  normalizeAttachmentUploadsInput,
  normalizeContextReposInput,
  normalizeEnvVarsInput
} = require('../src/app/validators');

describe('validators', () => {
  it('normalizes context repo input', () => {
    expect(normalizeContextReposInput(undefined)).toBe(null);
    expect(() => normalizeContextReposInput('bad')).toThrow(/contextRepos/);
    expect(() => normalizeContextReposInput(['bad'])).toThrow(/contextRepos\[0\]/);
    expect(() => normalizeContextReposInput([{}])).toThrow(/envId/);
    expect(normalizeContextReposInput([{ envId: ' env-2 ' }])).toEqual([
      { envId: 'env-2' }
    ]);
    expect(normalizeContextReposInput([{ envId: 'env-1', ref: 'main' }])).toEqual([
      { envId: 'env-1', ref: 'main' }
    ]);
  });

  it('normalizes attachment uploads input', () => {
    expect(normalizeAttachmentUploadsInput(undefined)).toBe(null);
    expect(() => normalizeAttachmentUploadsInput('bad')).toThrow(/fileUploads/);
    expect(() => normalizeAttachmentUploadsInput(['bad'])).toThrow(/fileUploads\[0\]/);
    expect(() => normalizeAttachmentUploadsInput([{}])).toThrow(/path/);
    expect(normalizeAttachmentUploadsInput([{ path: ' /tmp/raw.txt ' }])).toEqual([
      { path: '/tmp/raw.txt', originalName: null, size: null, mimeType: null }
    ]);
    expect(
      normalizeAttachmentUploadsInput([
        { path: '/tmp/file.txt', originalName: 'file.txt', size: 10, mimeType: 'text/plain' }
      ])
    ).toEqual([
      { path: '/tmp/file.txt', originalName: 'file.txt', size: 10, mimeType: 'text/plain' }
    ]);
  });

  it('normalizes attachment name input', () => {
    expect(normalizeAttachmentNamesInput(undefined, 'attachmentRemovals')).toBe(null);
    expect(() => normalizeAttachmentNamesInput('bad', 'attachmentRemovals')).toThrow(
      /attachmentRemovals/
    );
    expect(() => normalizeAttachmentNamesInput([''], 'attachmentRemovals')).toThrow(
      /attachmentRemovals\[0\]/
    );
    expect(() => normalizeAttachmentNamesInput([1], 'attachmentRemovals')).toThrow(
      /attachmentRemovals\[0\]/
    );
    expect(
      normalizeAttachmentNamesInput([' design-brief.md ', 'wireframe.png'], 'attachmentRemovals')
    ).toEqual(['design-brief.md', 'wireframe.png']);
  });

  it('normalizes env vars input', () => {
    expect(normalizeEnvVarsInput(undefined)).toBe(null);
    expect(() => normalizeEnvVarsInput('bad')).toThrow(/envVars/);
    expect(() => normalizeEnvVarsInput([null])).toThrow(/envVars\[0\]/);
    expect(() => normalizeEnvVarsInput([{ value: 'missing' }])).toThrow(/key/);
    expect(() => normalizeEnvVarsInput({ '1BAD': 'nope' })).toThrow(/invalid/);
    expect(() => normalizeEnvVarsInput({ EMPTY: null })).toThrow(/required/);
    expect(() => normalizeEnvVarsInput({ BAD: 'bad\0value' })).toThrow(/null byte/);
    expect(normalizeEnvVarsInput({ OK: 'yes', TOKEN: 123 })).toEqual({ OK: 'yes', TOKEN: '123' });
    expect(
      normalizeEnvVarsInput([{ key: 'FOO', value: 'bar=baz' }, { key: 'ALPHA', value: '1' }])
    ).toEqual({ FOO: 'bar=baz', ALPHA: '1' });
  });
});
