import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createMockExec, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { buildSpawnWithUsageLimit } from '../helpers/auto-rotate.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

async function setupOrchestrator(rateLimitsByToken) {
  const orchHome = await createTempDir();
  const codexHome = path.join(orchHome, 'codex-home');
  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));
  const spawnCalls = [];
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome,
    exec: createMockExec({ branches: ['main'] }),
    spawn: buildSpawnWithUsageLimit({ spawnCalls, rateLimitsByToken }),
    now: () => '2025-12-19T00:00:00.000Z'
  });

  await orchestrator.addAccount({ label: 'Primary', authJson: JSON.stringify({ token: 'primary' }) });
  await orchestrator.addAccount({ label: 'Secondary', authJson: JSON.stringify({ token: 'secondary' }) });
  return { codexHome, orchestrator, spawnCalls };
}

function createLimitsWithExhaustedFeatureMeter() {
  return {
    primary: { usedPercent: 5, windowDurationMins: 15, resetsAt: 1730947200 },
    secondary: null,
    credits: null,
    planType: 'prolite',
    additionalRateLimits: [
      {
        limitName: 'bonus',
        meteredFeature: 'priority_tasks',
        primary: { usedPercent: 100, windowDurationMins: 60, resetsAt: 1730950800 },
        secondary: null,
        windows: {
          primary: { usedPercent: 100, windowDurationMins: 60, resetsAt: 1730950800 }
        }
      }
    ],
    codeReviewRateLimit: {
      primary: { usedPercent: 100, windowDurationMins: 60, resetsAt: 1730950800 },
      secondary: null,
      windows: {
        primary: { usedPercent: 100, windowDurationMins: 60, resetsAt: 1730950800 }
      }
    }
  };
}

function createRenamedBaseWindowsWithExhaustedFeatureMeter() {
  return {
    primary: null,
    secondary: null,
    windows: {
      burst: { usedPercent: 5, windowDurationMins: 15, resetsAt: 1730947200 },
      sustain: { usedPercent: 10, windowDurationMins: 60, resetsAt: 1730950800 }
    },
    credits: null,
    planType: 'prolite',
    additionalRateLimits: [
      {
        limitName: 'bonus',
        meteredFeature: 'priority_tasks',
        primary: { usedPercent: 100, windowDurationMins: 60, resetsAt: 1730950800 },
        secondary: null,
        windows: {
          primary: { usedPercent: 100, windowDurationMins: 60, resetsAt: 1730950800 }
        }
      }
    ]
  };
}

async function waitForSpawnCalls(spawnCalls, minCount) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (spawnCalls.length >= minCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Orchestrator auto-rotate feature-specific rate limits', () => {
  it('keeps general task rotation based on the base account windows', async () => {
    const { codexHome, orchestrator, spawnCalls } = await setupOrchestrator({
      primary: {
        primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
        secondary: null,
        credits: null,
        planType: null
      },
      secondary: createLimitsWithExhaustedFeatureMeter()
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount).toBe(1);
    await waitForSpawnCalls(spawnCalls, 3);
    expect(spawnCalls.length).toBe(3);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'secondary' });
  });

  it('accepts renamed base windows without letting feature-specific meters block rotation', async () => {
    const { codexHome, orchestrator, spawnCalls } = await setupOrchestrator({
      primary: {
        primary: { usedPercent: 100, windowDurationMins: 15, resetsAt: 1730947200 },
        secondary: null,
        credits: null,
        planType: null
      },
      secondary: createRenamedBaseWindowsWithExhaustedFeatureMeter()
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount).toBe(1);
    await waitForSpawnCalls(spawnCalls, 3);
    expect(spawnCalls.length).toBe(3);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'secondary' });
  });
});
