import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseThreadId } = require('../../src/orchestrator');

describe('parseThreadId', () => {
  it('extracts thread_id from JSONL', () => {
    const jsonl = '{"type":"thread.started","thread_id":"abc"}\n{"type":"item.completed"}';
    expect(parseThreadId(jsonl)).toBe('abc');
  });

  it('ignores non-json lines and still finds thread_id', () => {
    const jsonl = 'banner line\n{"type":"thread.started","thread_id":"xyz"}\nnoise';
    expect(parseThreadId(jsonl)).toBe('xyz');
  });
});
