import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  buildAttachmentsSection,
  buildContextReposSection,
  buildCodexArgs
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

  it('builds top-level codex args with developer instructions and no fork_context override', () => {
    const args = buildCodexArgs({
      prompt: 'Do work',
      model: 'gpt-5.2-codex',
      reasoningEffort: 'medium',
      developerInstructions: 'You are the top-level orchestrator.'
    });

    expect(args).toEqual(
      expect.arrayContaining([
        'exec',
        '--dangerously-bypass-approvals-and-sandbox',
        '--json',
        '--model',
        'gpt-5.2-codex',
        '-c',
        'model_reasoning_effort=medium'
      ])
    );
    expect(args).toContain(
      `developer_instructions=${JSON.stringify('You are the top-level orchestrator.')}`
    );
    expect(args.some((arg) => typeof arg === 'string' && arg.includes('fork_context'))).toBe(false);
  });

  it('builds top-level resume args without any fork_context override', () => {
    const args = buildCodexArgs({
      prompt: 'Continue',
      developerInstructions: 'Resume the task.',
      resumeThreadId: 'thread-123'
    });

    expect(args).toEqual(
      expect.arrayContaining([
        'exec',
        '--dangerously-bypass-approvals-and-sandbox',
        '--json',
        'resume',
        'thread-123',
        'Continue'
      ])
    );
    expect(args).toContain(`developer_instructions=${JSON.stringify('Resume the task.')}`);
    expect(args.some((arg) => typeof arg === 'string' && arg.includes('fork_context'))).toBe(false);
  });
});
