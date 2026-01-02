import { describe, expect, it } from 'vitest';
import { buildDiffRows, getDiffStats } from '../src/app/diff-helpers.js';

describe('diff helpers', () => {
  it('counts additions and deletions in unified diff', () => {
    const diffText = [
      'diff --git a/file.txt b/file.txt',
      'index 123..456 100644',
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,2 +1,3 @@',
      ' line one',
      '-line two',
      '+line two updated',
      '+line three',
      '\\ No newline at end of file'
    ].join('\n');
    expect(getDiffStats(diffText)).toEqual({ additions: 2, deletions: 1 });
    expect(getDiffStats('')).toEqual({ additions: 0, deletions: 0 });
  });

  it('builds rows with line numbers and row types', () => {
    const diffText = [
      'diff --git a/file.txt b/file.txt',
      'index 123..456 100644',
      '--- a/file.txt',
      '+++ b/file.txt',
      '@@ -1,2 +1,3 @@',
      ' line one',
      '-line two',
      '+line two updated',
      '+line three',
      '\\ No newline at end of file'
    ].join('\n');
    const rows = buildDiffRows(diffText);
    expect(rows[0]).toEqual({
      type: 'hunk',
      oldLine: '',
      newLine: '',
      content: '@@ -1,2 +1,3 @@'
    });
    expect(rows[1]).toEqual({
      type: 'context',
      oldLine: 1,
      newLine: 1,
      content: 'line one'
    });
    expect(rows[2].type).toBe('del');
    expect(rows[3].type).toBe('add');
    expect(rows[4].type).toBe('add');
    expect(rows[rows.length - 1].type).toBe('meta');
  });

  it('captures non-hunk lines as meta rows', () => {
    const rows = buildDiffRows(['diff content', ' another line'].join('\n'));
    expect(rows).toEqual([
      { type: 'meta', oldLine: '', newLine: '', content: 'diff content' },
      { type: 'meta', oldLine: '', newLine: '', content: ' another line' }
    ]);
  });
});
