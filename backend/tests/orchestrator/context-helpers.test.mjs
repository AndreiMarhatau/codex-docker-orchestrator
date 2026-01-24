import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  buildAttachmentsSection,
  buildContextReposSection
} = require('../../src/orchestrator/context');

describe('context helpers', () => {
  it('renders context repos without explicit ref', () => {
    const section = buildContextReposSection(
      [{ envId: 'env-1', repoUrl: '', ref: '', worktreePath: '/tmp/repo', aliasName: 'repo' }],
      { repositoriesPath: '~/repositories' }
    );
    expect(section).toContain('env-1 at ~/repositories/repo');
    expect(section).not.toContain('()');
  });

  it('renders attachment entries with unknown placeholders', () => {
    const section = buildAttachmentsSection(
      [{ name: '', originalName: '', path: '' }],
      { uploadsPath: '~/uploads' }
    );
    expect(section).toContain('- unknown at unknown');
  });

  it('renders attachment entries with uploads path when name is available', () => {
    const section = buildAttachmentsSection(
      [{ name: 'report.txt', originalName: 'report.txt', path: '/tmp/report.txt' }],
      { uploadsPath: '~/uploads' }
    );
    expect(section).toContain('- report.txt at ~/uploads/report.txt');
  });

  it('renders context repos with worktree path when alias is missing', () => {
    const section = buildContextReposSection(
      [{ envId: 'env-1', repoUrl: '', ref: '', worktreePath: '/tmp/repo' }],
      { repositoriesPath: '~/repositories' }
    );
    expect(section).toContain('env-1 at /tmp/repo');
  });

  it('uses template files when provided', async () => {
    const tempDir = await createTempDir();
    const templatePath = path.join(tempDir, 'template.md');
    await fs.writeFile(
      templatePath,
      'Uploads live at {{uploadsPath}}\\n{{attachmentsList}}',
      'utf8'
    );
    const section = buildAttachmentsSection(
      [{ name: 'note.txt', originalName: 'note.txt', path: '/tmp/note.txt' }],
      { uploadsPath: '~/uploads', templatePath }
    );
    expect(section).toContain('Uploads live at ~/uploads');
    expect(section).toContain('- note.txt at ~/uploads/note.txt');
  });
});
