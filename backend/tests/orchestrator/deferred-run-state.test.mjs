import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createDeferredRunState,
  createStoppedDuringStartupError,
  isAbortError
} = require('../../src/orchestrator/tasks/deferred-run-state');

describe('deferred run state helpers', () => {
  it('creates pending run state and stop errors', () => {
    expect(createDeferredRunState()).toMatchObject({
      child: null,
      pendingStart: true,
      stopRequested: false
    });
    expect(createStoppedDuringStartupError()).toMatchObject({
      message: 'Stopped by user.',
      stopped: true
    });
  });

  it('recognizes abort errors by name or code', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError({ code: 'ABORT_ERR' })).toBe(true);
    expect(isAbortError({ name: 'OtherError' })).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
