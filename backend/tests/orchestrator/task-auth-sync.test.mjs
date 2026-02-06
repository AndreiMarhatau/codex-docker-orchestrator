import path from 'node:path';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function createRunSpawn({ threadId, authFactory, closeDelayMs = 0, onClosed } = {}) {
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

    setImmediate(async () => {
      child.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: threadId }) + '\n');
      setTimeout(async () => {
        const authContent = authFactory(options.env.CODEX_HOME);
        await fs.writeFile(
          path.join(options.env.CODEX_HOME, 'auth.json'),
          JSON.stringify(authContent, null, 2)
        );
        child.stdout.end();
        child.emit('close', 0, null);
        onClosed?.();
      }, closeDelayMs);
    });

    return child;
  };
}

async function createOrchestratorWithPrimary(orchHome) {
  const codexHome = path.join(orchHome, 'codex-home');
  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(
    path.join(codexHome, 'auth.json'),
    JSON.stringify(
      {
        tokens: {
          access_token: 'old',
          refresh_token: 'old-refresh'
        }
      },
      null,
      2
    )
  );

  return {
    codexHome,
    exec: createMockExec({ branches: ['main'] })
  };
}

describe('Orchestrator task auth synchronization', () => {
  it('persists refreshed auth tokens back to the active account after a run', async () => {
    const orchHome = await createTempDir();
    const { codexHome, exec } = await createOrchestratorWithPrimary(orchHome);
    const spawn = createRunSpawn({
      threadId: 'thread-refresh',
      authFactory: () => ({
        tokens: {
          access_token: 'new',
          refresh_token: 'new-refresh'
        }
      })
    });

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const accounts = await orchestrator.listAccounts();
    expect(accounts.accounts).toHaveLength(1);
    expect(accounts.accounts[0].isActive).toBe(true);
    expect(accounts.accounts[0].authJson).toContain('"access_token": "new"');
    expect(accounts.accounts[0].authJson).toContain('"refresh_token": "new-refresh"');
  });
});

describe('Orchestrator run-account sync targeting', () => {
  it('syncs refreshed tokens to the run account even if active account changes mid-run', async () => {
    const orchHome = await createTempDir();
    const { codexHome, exec } = await createOrchestratorWithPrimary(orchHome);

    let finishSignal;
    const finished = new Promise((resolve) => {
      finishSignal = resolve;
    });
    const spawn = createRunSpawn({
      threadId: 'thread-race',
      closeDelayMs: 100,
      authFactory: () => ({
        tokens: {
          access_token: 'primary-new',
          refresh_token: 'primary-new-refresh'
        }
      }),
      onClosed: () => finishSignal()
    });

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });

    await orchestrator.addAccount({
      label: 'Secondary',
      authJson: JSON.stringify({
        tokens: {
          access_token: 'secondary-old',
          refresh_token: 'secondary-old-refresh'
        }
      })
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });

    const accountsBefore = await orchestrator.listAccounts();
    const primaryRunAccountId = task.runs[0].accountId;
    const secondary = accountsBefore.accounts.find((account) => account.id !== primaryRunAccountId);
    await orchestrator.activateAccount(secondary.id);
    await finished;
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const accountsAfter = await orchestrator.listAccounts();
    const primary = accountsAfter.accounts.find((account) => account.id === primaryRunAccountId);
    const secondaryAfter = accountsAfter.accounts.find((account) => account.id === secondary.id);

    expect(primary.authJson).toContain('"access_token": "primary-new"');
    expect(primary.authJson).toContain('"refresh_token": "primary-new-refresh"');
    expect(secondaryAfter.authJson).toContain('"access_token": "secondary-old"');
    expect(secondaryAfter.authJson).toContain('"refresh_token": "secondary-old-refresh"');
  });
});
