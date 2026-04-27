import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  createManualAppServerSpawn,
  createMockExec,
  createMockSpawn,
  createTempDir
} from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

function resolveMountedPath(options, targetPath) {
  const mounts = String(options?.env?.CODEX_VOLUME_MOUNTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const match = mounts.find((entry) => entry.includes(`=${targetPath}`) || entry.includes(`=${targetPath}:ro`));
  if (!match) {
    return null;
  }
  const [source] = match.split('=');
  const slashIndex = source.indexOf('/');
  if (slashIndex === -1) {
    return null;
  }
  const subpath = source.slice(slashIndex + 1);
  const root = options?.env?.ORCH_DATA_DIR;
  if (!root) {
    return null;
  }
  return path.join(root, subpath);
}

function createRunSpawn({ threadId, authFactory, closeDelayMs = 0, onClosed } = {}) {
  return createMockSpawn({
    threadId,
    turnCompletionDelayMs: closeDelayMs,
    onBeforeTurnComplete: async ({ options }) => {
      if (options?.env?.ORCH_STRUCTURED_CODEX === '1') {
        return;
      }
      const codexHome = resolveMountedPath(options, '/root/.codex');
      const authContent = authFactory(codexHome);
      await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify(authContent, null, 2));
      onClosed?.();
    }
  });
}

async function waitForRunServer(spawn) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const server = spawn.latestServer();
    if (server) {
      await server.waitForTurnStart();
      return server;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for app-server run');
}

async function writeAuthForServer(server, authContent) {
  const codexHome = resolveMountedPath(server.call.options, '/root/.codex');
  await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify(authContent, null, 2));
}

async function createOrchestratorWithPrimary(orchHome) {
  const codexHome = path.join(orchHome, 'codex-home');
  await fs.mkdir(codexHome, { recursive: true });
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
    await orchestrator.addAccount({
      label: 'Primary',
      authJson: JSON.stringify({
        tokens: {
          access_token: 'old',
          refresh_token: 'old-refresh'
        }
      })
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

    const spawn = createManualAppServerSpawn({ threadId: 'thread-race' });

    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });
    await orchestrator.addAccount({
      label: 'Primary',
      authJson: JSON.stringify({
        tokens: {
          access_token: 'old',
          refresh_token: 'old-refresh'
        }
      })
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
    const server = await waitForRunServer(spawn);

    const accountsBefore = await orchestrator.listAccounts();
    const primaryRunAccountId = task.runs[0].accountId;
    const secondary = accountsBefore.accounts.find((account) => account.id !== primaryRunAccountId);
    await orchestrator.activateAccount(secondary.id);
    await writeAuthForServer(server, {
      tokens: {
        access_token: 'primary-new',
        refresh_token: 'primary-new-refresh'
      }
    });
    server.completeTurn();
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
