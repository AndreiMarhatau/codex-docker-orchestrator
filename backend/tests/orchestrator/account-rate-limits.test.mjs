import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function createRateLimitSpawn({ updatedAuth, responseDelayMs = 0 } = {}) {
  return (command, args, options = {}) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => {
      setImmediate(() => {
        child.emit('close', 143, 'SIGTERM');
      });
    };

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
          const message = JSON.parse(line);
          if (message.method === 'initialize') {
            child.stdout.write(`${JSON.stringify({ id: message.id, result: { userAgent: 'codex-mock' } })}\n`);
          }
          if (message.method === 'account/rateLimits/read') {
            const persistAuth = updatedAuth
              ? fs.writeFile(path.join(options.env.CODEX_HOME, 'auth.json'), JSON.stringify(updatedAuth, null, 2))
              : Promise.resolve();
            persistAuth.then(() => {
              child.stdout.write(
                `${JSON.stringify({ id: message.id, result: { rateLimits: { primary: { usedPercent: 42 } } } })}\n`
              );
              setTimeout(() => {
                child.stdout.end();
                child.emit('close', 0, null);
              }, responseDelayMs);
            });
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    return child;
  };
}

describe('Orchestrator account rate-limit reads', () => {
  it('persists refreshed auth for the active account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec: createMockExec({ branches: ['main'] }),
      spawn: createRateLimitSpawn({ updatedAuth: { token: 'new' } }),
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const account = await orchestrator.addAccount({ label: 'Primary', authJson: '{"token":"old"}' });
    const limits = await orchestrator.getAccountRateLimits();
    expect(limits.account.id).toBe(account.id);

    const accounts = await orchestrator.listAccounts();
    const active = accounts.accounts.find((entry) => entry.id === account.id);
    expect(active.authJson).toContain('"token": "new"');
  });

  it('does not sync auth when active account changes during read', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec: createMockExec({ branches: ['main'] }),
      spawn: createRateLimitSpawn({ responseDelayMs: 100 }),
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const primary = await orchestrator.addAccount({ label: 'Primary', authJson: '{"token":"primary-old"}' });
    const secondary = await orchestrator.addAccount({ label: 'Secondary', authJson: '{"token":"secondary-old"}' });
    const limitsPromise = orchestrator.getAccountRateLimits();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await orchestrator.activateAccount(secondary.id);
    await limitsPromise;

    const accounts = await orchestrator.listAccounts();
    const primaryAuth = JSON.parse(accounts.accounts.find((entry) => entry.id === primary.id).authJson);
    const secondaryAuth = JSON.parse(accounts.accounts.find((entry) => entry.id === secondary.id).authJson);
    expect(primaryAuth).toEqual({ token: 'primary-old' });
    expect(secondaryAuth).toEqual({ token: 'secondary-old' });
  });

  it('triggers usage with a lightweight codex run in an empty workspace', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    const spawn = createMockSpawn();

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec: createMockExec({ branches: ['main'] }),
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const account = await orchestrator.addAccount({ label: 'Primary', authJson: '{}' });
    const result = await orchestrator.triggerAccountUsage();
    expect(result.account.id).toBe(account.id);
    expect(result.prompt).toContain('Reply with exactly "Hi"');

    const triggerCall = spawn.calls.find(
      (call) =>
        call.command === 'codex-docker' &&
        call.args.includes('exec') &&
        call.args.includes('--skip-git-repo-check')
    );
    expect(triggerCall).toBeTruthy();
    expect(triggerCall.options.cwd).toContain('codex-usage-trigger-');
    expect(triggerCall.options.cwd).not.toBe(triggerCall.options.env.CODEX_HOME);
  });
});
