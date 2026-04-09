import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createMockExec, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function createDecodeFailureSpawn(message) {
  return (command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => setImmediate(() => child.emit('close', 143, 'SIGTERM'));

    if (command !== 'codex-docker' || args[0] !== 'app-server') {
      setImmediate(() => child.emit('close', 0, null));
      return child;
    }

    let buffer = '';
    child.stdin.on('data', (chunk) => {
      buffer += chunk.toString();
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          const parsed = JSON.parse(line);
          if (parsed.method === 'initialize') {
            child.stdout.write(`${JSON.stringify({ id: parsed.id, result: { userAgent: 'codex-mock' } })}\n`);
          }
          if (parsed.method === 'account/rateLimits/read') {
            child.stdout.write(`${JSON.stringify({ id: parsed.id, error: { message } })}\n`);
            child.stdout.end();
            child.emit('close', 1, null);
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    return child;
  };
}

function createFallbackResponse() {
  return new Response(
    JSON.stringify({
      plan_type: 'prolite',
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 42,
          limit_window_seconds: 900,
          reset_after_seconds: 120,
          reset_at: 1730947200
        }
      },
      additional_rate_limits: [
        {
          limit_name: 'bonus',
          metered_feature: 'priority_tasks',
          rate_limit: {
            primary_window: {
              used_percent: 10,
              limit_window_seconds: 3600,
              reset_at: 1730950800
            }
          }
        }
      ],
      credits: {
        has_credits: true,
        unlimited: false,
        balance: '$5'
      }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

describe('Orchestrator account rate-limit fallback', () => {
  it('falls back to direct wham usage fetch for unknown plan types', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });

    const fetch = vi.fn(async () => createFallbackResponse());
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec: createMockExec({ branches: ['main'] }),
      spawn: createDecodeFailureSpawn(
        'decoding https://chatgpt.com/backend-api/wham/usage failed: unknown variant `prolite` for `plan_type`'
      ),
      fetch,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    await orchestrator.addAccount({
      label: 'Primary',
      authJson: JSON.stringify({ tokens: { access_token: 'access-token' } })
    });

    const limits = await orchestrator.getAccountRateLimits();

    expect(fetch).toHaveBeenCalledWith(
      'https://chatgpt.com/backend-api/wham/usage',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' })
      })
    );
    expect(limits.rateLimits.planType).toBe('prolite');
    expect(limits.rateLimits.primary.usedPercent).toBe(42);
    expect(limits.rateLimits.primary.windowDurationMins).toBe(15);
    expect(limits.rateLimits.primary.resetsAt).toBe(1730947200);
    expect(limits.rateLimits.credits.balance).toBe('$5');
    expect(limits.rateLimits.additionalRateLimits[0].windows.primary.usedPercent).toBe(10);
  });

  it('rethrows non-wham app-server errors without falling back', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const fetch = vi.fn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec: createMockExec({ branches: ['main'] }),
      spawn: createDecodeFailureSpawn('Failed to read account rate limits.'),
      fetch,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    await orchestrator.addAccount({ label: 'Primary', authJson: '{}' });

    await expect(orchestrator.getAccountRateLimits()).rejects.toThrow('Failed to read account rate limits.');
    expect(fetch).not.toHaveBeenCalled();
  });
});
