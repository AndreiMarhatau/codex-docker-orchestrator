import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildAttachmentsSection,
  buildContextReposSection
} = require('../../src/orchestrator/context');

describe('context helpers', () => {
  it('renders context repos without explicit ref', () => {
    const section = buildContextReposSection([
      { envId: 'env-1', repoUrl: '', ref: '', worktreePath: '/tmp/repo' }
    ]);
    expect(section).toContain('env-1 at /tmp/repo');
    expect(section).not.toContain('()');
  });

  it('renders attachment entries with unknown placeholders', () => {
    const section = buildAttachmentsSection([{ name: '', originalName: '', path: '' }]);
    expect(section).toContain('- unknown at unknown');
  });
});
