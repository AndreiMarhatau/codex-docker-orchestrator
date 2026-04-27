import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeReviewTarget } = require('../../src/domains/tasks/operations/review');

describe('review helpers', () => {
  it('normalizes supported review targets', () => {
    expect(normalizeReviewTarget()).toEqual({ type: 'uncommittedChanges' });
    expect(normalizeReviewTarget({ targetType: 'baseBranch', branch: ' main ' }))
      .toEqual({ type: 'baseBranch', branch: 'main' });
    expect(normalizeReviewTarget({
      type: 'commit',
      commitSha: ' abc123 ',
      commitTitle: ' Fix bug '
    })).toEqual({ type: 'commit', sha: 'abc123', title: 'Fix bug' });
    expect(normalizeReviewTarget({ type: 'commit', sha: ' def456 ' }))
      .toEqual({ type: 'commit', sha: 'def456', title: null });
    expect(normalizeReviewTarget({ type: 'custom', instructions: ' inspect auth ' }))
      .toEqual({ type: 'custom', instructions: 'inspect auth' });
  });

  it('rejects invalid review targets', () => {
    expect(() => normalizeReviewTarget({ type: 'baseBranch' })).toThrow(/baseBranch/);
    expect(() => normalizeReviewTarget({ type: 'commit' })).toThrow(/commit sha/);
    expect(() => normalizeReviewTarget({ type: 'custom' })).toThrow(/custom review/);
    expect(() => normalizeReviewTarget({ type: 'unknown' })).toThrow(/Unknown/);
  });
});
