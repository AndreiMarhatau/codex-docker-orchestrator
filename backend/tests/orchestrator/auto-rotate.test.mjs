import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { countAppServerTaskRuns, createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';
import { buildSpawnWithUsageLimit } from '../helpers/auto-rotate.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator auto-rotate', () => {
  it('does not auto-rotate when usage limit appears in agent output of a successful run', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));

    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn({
      defaultAgentMessageText: 'Approaching usage limit, switching soon.'
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
      authJson: JSON.stringify({ token: 'primary' })
    });

    await orchestrator.addAccount({
      label: 'Secondary',
      authJson: JSON.stringify({ token: 'secondary' })
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const completed = await waitForTaskStatus(orchestrator, task.taskId, 'completed');
    expect(completed.autoRotateCount || 0).toBe(0);
    expect(countAppServerTaskRuns(spawn.calls)).toBe(1);

    const activeAuth = JSON.parse(await fs.readFile(path.join(codexHome, 'auth.json'), 'utf8'));
    expect(activeAuth).toEqual({ token: 'primary' });
  });

  it('skips rotation when usage limit hits an outdated account', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ token: 'primary' }, null, 2));

    const exec = createMockExec({ branches: ['main'] });
    const spawnCalls = [];
    let orchestrator = null;
    const spawn = buildSpawnWithUsageLimit({
      spawnCalls,
      onBeforeLimit: async () => {
        await orchestrator.accountStore.rotateActiveAccount();
      }
    });

    orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn,
      now: () => '2025-12-19T00:00:00.000Z'
    });
    await orchestrator.addAccount({
      label: 'Primary',
      authJson: JSON.stringify({ token: 'primary' })
    });

    await orchestrator.addAccount({
      label: 'Secondary',
      authJson: JSON.stringify({ token: 'secondary' })
    });

    const env = await orchestrator.createEnv({ repoUrl: 'git@example.com:repo.git', defaultBranch: 'main' });
    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });

    const failed = await waitForTaskStatus(orchestrator, task.taskId, 'failed');
    expect(failed.autoRotateCount || 0).toBe(0);
    expect(countAppServerTaskRuns(spawnCalls)).toBe(1);
  });
});
