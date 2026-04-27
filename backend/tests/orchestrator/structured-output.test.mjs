import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseJsonObject } = require('../../src/shared/codex/structured-output');

describe('structured output parsing', () => {
  it('parses direct and embedded JSON objects', () => {
    expect(parseJsonObject('{"message":"ok"}')).toEqual({ message: 'ok' });
    expect(parseJsonObject('prefix {"message":"ok"} suffix')).toEqual({ message: 'ok' });
  });

  it('returns null for empty or malformed structured output', () => {
    expect(parseJsonObject('')).toBeNull();
    expect(parseJsonObject(null)).toBeNull();
    expect(parseJsonObject({ message: 'ok' })).toBeNull();
    expect(parseJsonObject('plain text')).toBeNull();
    expect(parseJsonObject('prefix {bad json} suffix')).toBeNull();
  });
});
