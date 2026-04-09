import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  collectBaseRateLimitWindows,
  normalizeRateLimits
} = require('../../src/orchestrator/account-rate-limits-normalizer');

describe('account rate-limit normalization', () => {
  it('keeps opaque plan names and normalizes dynamic base and feature window names', () => {
    const normalized = normalizeRateLimits({
      plan_type: 'proliteplus',
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 40,
          limit_window_seconds: 900,
          reset_after_seconds: 60,
          reset_at: 1730947200
        },
        burst_window: {
          used_percent: 5,
          limit_window_seconds: 300,
          reset_at: 1730946900
        },
        windows: {
          longSession: {
            used_percent: 15,
            limit_window_seconds: 7200,
            reset_at: 1730954400
          }
        }
      },
      credits: {
        has_credits: false
      },
      code_review_rate_limit: {
        rate_limit: {
          secondary_window: {
            used_percent: 25,
            limit_window_seconds: 1800,
            reset_at: 1730949000
          }
        }
      }
    });

    expect(normalized.planType).toBe('proliteplus');
    expect(normalized.allowed).toBe(true);
    expect(normalized.limitReached).toBe(false);
    expect(normalized).not.toHaveProperty('primary');
    expect(normalized).not.toHaveProperty('secondary');
    expect(normalized.windows.primary.windowDurationMins).toBe(15);
    expect(normalized.windows.burst.usedPercent).toBe(5);
    expect(normalized.windows.long_session.usedPercent).toBe(15);
    expect(normalized.windows.long_session.windowDurationMins).toBe(120);
    expect(normalized.credits.hasCredits).toBe(false);
    expect(normalized.codeReviewRateLimit.windows.secondary.usedPercent).toBe(25);
    expect(normalized.codeReviewRateLimit).not.toHaveProperty('primary');
    expect(normalized.codeReviewRateLimit).not.toHaveProperty('secondary');
  });

  it('collects only base normalized windows for general eligibility checks', () => {
    const windows = collectBaseRateLimitWindows({
      windows: {
        burst: { usedPercent: 10 },
        sustain: { usedPercent: 20 }
      },
      additionalRateLimits: [
        {
          windows: {
            feature: { usedPercent: 100 }
          }
        }
      ],
      codeReviewRateLimit: {
        windows: {
          review: { usedPercent: 100 }
        }
      }
    });

    expect(windows).toEqual([{ usedPercent: 10 }, { usedPercent: 20 }]);
  });
});
