import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const {
  buildDeveloperInstructions,
  mergeDeveloperInstructions,
  readTopLevelDeveloperInstructions
} = require('../../src/orchestrator/tasks/instructions');

describe('task instructions helpers', () => {
  it('merges user and orchestrator instructions with trimming', () => {
    expect(mergeDeveloperInstructions('', '')).toBeNull();
    expect(mergeDeveloperInstructions('  Keep it short.  ', '  Add context.  ')).toBe(
      'Keep it short.\n\nAdd context.\n'
    );
    expect(mergeDeveloperInstructions('', 'Only orchestrator')).toBe('Only orchestrator\n');
  });

  it('reads top-level developer instructions from literal and multiline TOML strings', async () => {
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      [
        "developer_instructions = 'Keep edits minimal.'",
        '',
        '[profiles.default]',
        'model = "gpt-5.4"'
      ].join('\n'),
      'utf8'
    );
    expect(readTopLevelDeveloperInstructions(codexHome)).toBe('Keep edits minimal.');

    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      'developer_instructions = """\nLine one.\nLine two.\n"""\n',
      'utf8'
    );
    expect(readTopLevelDeveloperInstructions(codexHome)).toBe('Line one.\nLine two.');
  });

  it('prefers the active profile developer instructions over the root value', async () => {
    const codexHome = await createTempDir();
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      [
        'profile = "team"',
        'developer_instructions = "Root fallback."',
        '',
        '[profiles.team]',
        'developer_instructions = """Profile wins."""'
      ].join('\n'),
      'utf8'
    );
    expect(readTopLevelDeveloperInstructions(codexHome)).toBe('Profile wins.');
  });

  it('ignores missing, invalid, and unterminated top-level developer instructions', async () => {
    const missingHome = await createTempDir();
    expect(readTopLevelDeveloperInstructions(missingHome)).toBe('');

    const invalidHome = await createTempDir();
    await fs.writeFile(
      path.join(invalidHome, 'config.toml'),
      'developer_instructions = "unterminated\n',
      'utf8'
    );
    expect(readTopLevelDeveloperInstructions(invalidHome)).toBe('');

    const unterminatedHome = await createTempDir();
    await fs.writeFile(
      path.join(unterminatedHome, 'config.toml'),
      'developer_instructions = """\nnever closed\n',
      'utf8'
    );
    expect(readTopLevelDeveloperInstructions(unterminatedHome)).toBe('');
  });

  it('throws when the orchestrator instructions path is not a file', async () => {
    const tempDir = await createTempDir();
    await expect(() =>
      buildDeveloperInstructions.call(
        {
          orchInstructionsFile: tempDir,
          contextReposTemplateFile: null,
          attachmentsTemplateFile: null
        },
        {}
      )
    ).toThrow(/not a file/i);
  });

  it('returns null when no instruction sections are available', () => {
    const result = buildDeveloperInstructions.call(
      {
        orchInstructionsFile: null,
        contextReposTemplateFile: null,
        attachmentsTemplateFile: null
      },
      {}
    );
    expect(result).toBeNull();
  });
});
