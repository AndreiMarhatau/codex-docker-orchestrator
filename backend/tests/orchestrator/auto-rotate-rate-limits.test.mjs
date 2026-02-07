import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { buildSpawnWithUsageLimit } from '../helpers/auto-rotate.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function setupOrchestrator({
  rateLimitsByToken,
  accounts,
  refreshedAuthByToken,
  refreshedAuthRawByToken
}) {
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

  return { orchHome, codexHome, orchestrator, spawnCalls };
}

describe('Orchestrator auto-rotate rate limits', () => {
  it('auto-rotates accounts on usage limit and resumes', async () => {
    const { codexHome, orchestrator, spawnCalls } = await setupOrchestrator({
      rateLimitsByToken: {
        primary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        },
        secondary: {
          primary: { usedPercent: 10, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        }
      },
      accounts: [{ label: 'Secondary', token: 'secondary' }]
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount).toBe(1);
    expect(spawnCalls.length).toBe(3);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'secondary' });
  });

  it('does not auto-rotate when all remaining accounts are exhausted', async () => {
    const { codexHome, orchestrator, spawnCalls } = await setupOrchestrator({
      rateLimitsByToken: {
        primary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        },
        secondary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        }
      },
      accounts: [{ label: 'Secondary', token: 'secondary' }]
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const failed = await waitForTaskStatus(orchestrator, task.taskId, 'failed');
    expect(failed.autoRotateCount || 0).toBe(0);
    expect(spawnCalls.length).toBe(2);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'primary' });
  });

  it('auto-rotates past exhausted accounts to one with usage left', async () => {
    const { codexHome, orchestrator, spawnCalls } = await setupOrchestrator({
      rateLimitsByToken: {
        primary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        },
        secondary: {
          primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        },
        tertiary: {
          primary: { usedPercent: 5, windowDurationMins: 15, resetsAt: 1730947200 },
          secondary: null,
          credits: null,
          planType: null
        }
      },
      accounts: [
        { label: 'Secondary', token: 'secondary' },
        { label: 'Tertiary', token: 'tertiary' }
      ]
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount).toBe(1);
    expect(spawnCalls.length).toBe(4);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'tertiary' });
  });

});
