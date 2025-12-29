import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { repoNameFromUrl, nextRunLabel, normalizeOptionalString } = require('../../src/orchestrator/utils');

describe('orchestrator utils', () => {
  it('derives repo names from urls and paths', () => {
    expect(repoNameFromUrl('')).toBe('worktree');
    expect(repoNameFromUrl('https://github.com/openai/codex-docker-orchestrator.git')).toBe(
      'codex-docker-orchestrator'
    );
    expect(repoNameFromUrl('git@example.com:repo.git')).toBe('repo');
    expect(repoNameFromUrl('/tmp/repo')).toBe('repo');
  });

  it('formats run labels and normalizes optional strings', () => {
    expect(nextRunLabel(1)).toBe('run-001');
    expect(nextRunLabel(12)).toBe('run-012');
    expect(normalizeOptionalString('  value ')).toBe('value');
    expect(normalizeOptionalString('')).toBe(null);
    expect(normalizeOptionalString(42)).toBe(null);
  });
});
