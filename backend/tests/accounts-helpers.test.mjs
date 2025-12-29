import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeLabel, parseAuthJson } = require('../src/accounts-helpers');

describe('account helpers', () => {
  it('normalizes labels', () => {
    expect(normalizeLabel('  Name ', 'fallback')).toBe('Name');
    expect(normalizeLabel('', 'fallback')).toBe('fallback');
    expect(normalizeLabel(42, 'fallback')).toBe('fallback');
  });

  it('parses auth json safely', () => {
    expect(() => parseAuthJson('')).toThrow(/authJson/);
    expect(() => parseAuthJson('{')).toThrow(/authJson/);
    expect(parseAuthJson('{"token":"x"}')).toEqual({ token: 'x' });
  });
});
