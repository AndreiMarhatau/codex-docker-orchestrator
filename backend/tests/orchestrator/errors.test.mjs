import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { invalidImageError, invalidContextError, noActiveAccountError } = require('../../src/orchestrator/errors');

describe('orchestrator errors', () => {
  it('creates typed errors', () => {
    const imageError = invalidImageError('bad image');
    expect(imageError.code).toBe('INVALID_IMAGE');

    const contextError = invalidContextError('bad context');
    expect(contextError.code).toBe('INVALID_CONTEXT');

    const accountError = noActiveAccountError('missing');
    expect(accountError.code).toBe('NO_ACTIVE_ACCOUNT');
  });
});
