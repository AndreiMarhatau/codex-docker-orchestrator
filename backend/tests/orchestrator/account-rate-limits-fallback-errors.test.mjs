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
        primary_window: {
          used_percent: 42,
          limit_window_seconds: 900,
          reset_at: 1730947200
        }
      }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

async function createOrchestrator({ message, fetch, authJson = '{}' }) {
  const orchHome = await createTempDir();
  const codexHome = path.join(orchHome, 'codex-home');
  await fs.mkdir(codexHome, { recursive: true });
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome,
    exec: createMockExec({ branches: ['main'] }),
    spawn: createDecodeFailureSpawn(message),
    fetch,
    now: () => '2025-12-19T00:00:00.000Z'
  });
  await orchestrator.addAccount({ label: 'Primary', authJson });
  return orchestrator;
}

describe('Orchestrator account rate-limit fallback error handling', () => {
  it('falls back for generic upstream decode failures without relying on endpoint wording', async () => {
    const fetch = vi.fn(async () => createFallbackResponse());
    const orchestrator = await createOrchestrator({
      message: 'Failed to deserialize rate limit response: missing field `plan_type`',
      fetch,
      authJson: JSON.stringify({ tokens: { access_token: 'access-token' } })
    });

    const limits = await orchestrator.getAccountRateLimits();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(limits.rateLimits.planType).toBe('prolite');
  });

  it('does not mask unrelated upstream failures that happen to mention decode-adjacent text', async () => {
    const fetch = vi.fn();
    const orchestrator = await createOrchestrator({
      message: 'Service unavailable while decoding upstream response',
      fetch
    });

    await expect(orchestrator.getAccountRateLimits()).rejects.toThrow(
      'Service unavailable while decoding upstream response'
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces direct fallback fetch failures', async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'token expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    );
    const orchestrator = await createOrchestrator({
      message: 'decoding https://chatgpt.com/backend-api/wham/usage failed',
      fetch,
      authJson: JSON.stringify({ tokens: { access_token: 'access-token' } })
    });

    await expect(orchestrator.getAccountRateLimits()).rejects.toThrow('token expired');
  });

  it('accepts legacy root access tokens during fallback', async () => {
    const fetch = vi.fn(async () => createFallbackResponse());
    const orchestrator = await createOrchestrator({
      message: 'decoding https://chatgpt.com/backend-api/wham/usage failed',
      fetch,
      authJson: JSON.stringify({ access_token: 'legacy-access-token' })
    });

    await orchestrator.getAccountRateLimits();
    expect(fetch).toHaveBeenCalledWith(
      'https://chatgpt.com/backend-api/wham/usage',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer legacy-access-token' })
      })
    );
  });

  it('uses the default fallback error when the direct response is not json', async () => {
    const fetch = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    const orchestrator = await createOrchestrator({
      message: 'decoding https://chatgpt.com/backend-api/wham/usage failed',
      fetch,
      authJson: JSON.stringify({ tokens: { access_token: 'access-token' } })
    });

    await expect(orchestrator.getAccountRateLimits()).rejects.toThrow(
      'Direct rate-limit fetch failed with status 502.'
    );
  });
});
