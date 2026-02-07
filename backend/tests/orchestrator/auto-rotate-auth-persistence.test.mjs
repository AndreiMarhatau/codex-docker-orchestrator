import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { buildSpawnWithUsageLimit } from '../helpers/auto-rotate.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function setupOrchestrator({ rateLimitsByToken, accounts, refreshedAuthByToken, refreshedAuthRawByToken }) {
  const orchHome = await createTempDir();
  const codexHome = path.join(orchHome, 'codex-home');
  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));
  const exec = createMockExec({ branches: ['main'] });
  const spawnCalls = [];
  const spawn = buildSpawnWithUsageLimit({
    spawnCalls,
    rateLimitsByToken,
    refreshedAuthByToken,
    refreshedAuthRawByToken
  });
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome,
    exec,
    spawn,
    now: () => '2025-12-19T00:00:00.000Z'
  });

  for (const account of accounts) {
    await orchestrator.addAccount({
      label: account.label,
      authJson: JSON.stringify({ token: account.token })
    });
  }

  return { orchHome, orchestrator };
}

describe('Orchestrator auto-rotate auth persistence', () => {
  it('persists refreshed candidate auth when probing usage limits', async () => {
    const { orchHome, orchestrator } = await setupOrchestrator({
      rateLimitsByToken: {
        primary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        },
        secondary: {
          primary: { usedPercent: 5, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        }
      },
      refreshedAuthByToken: { secondary: { token: 'secondary-refreshed' } },
      accounts: [{ label: 'Secondary', token: 'secondary' }]
    });
    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const accountsState = await orchestrator.listAccounts();
    const secondaryAccount = accountsState.accounts.find((account) => account.label === 'Secondary');
    const secondaryAuth = JSON.parse(
      await fs.readFile(path.join(orchHome, 'accounts', secondaryAccount.id, 'auth.json'), 'utf8')
    );
    expect(secondaryAuth).toEqual({ token: 'secondary-refreshed' });
  });

  it('keeps account eligible when refreshed auth is malformed', async () => {
    const { orchHome, orchestrator } = await setupOrchestrator({
      rateLimitsByToken: {
        primary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        },
        secondary: {
          primary: { usedPercent: 5, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        }
      },
      refreshedAuthRawByToken: { secondary: '{bad-json' },
      accounts: [{ label: 'Secondary', token: 'secondary' }]
    });
    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({ envId: env.envId, ref: 'main', prompt: 'Do work' });
    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount).toBe(1);

    const accountsState = await orchestrator.listAccounts();
    const secondaryAccount = accountsState.accounts.find((account) => account.label === 'Secondary');
    const secondaryAuth = JSON.parse(
      await fs.readFile(path.join(orchHome, 'accounts', secondaryAccount.id, 'auth.json'), 'utf8')
    );
    expect(secondaryAuth).toEqual({ token: 'secondary' });
  });
});
