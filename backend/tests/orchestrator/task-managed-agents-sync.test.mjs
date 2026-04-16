import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('task managed agent syncing', () => {
  it('refreshes managed developer agents before create and resume after config changes', async () => {
    const orchHome = await createTempDir();
    const codexHome = path.join(orchHome, 'codex-home');
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome,
      exec,
      spawn
    });

    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      "developer_instructions = 'First rule.'\n"
    );

    const env = await orchestrator.createEnv({
      repoUrl: 'git@example.com:repo.git',
      defaultBranch: 'main'
    });

    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work'
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const developerPath = path.join(codexHome, 'agents', 'developer.toml');
    expect(await fs.readFile(developerPath, 'utf8')).toContain('First rule.');

    await fs.writeFile(
      path.join(codexHome, 'config.toml'),
      "developer_instructions = 'Second rule.'\n"
    );

    await orchestrator.resumeTask(task.taskId, 'Continue');
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const refreshedDeveloper = await fs.readFile(developerPath, 'utf8');
    expect(refreshedDeveloper).toContain('Second rule.');
    expect(refreshedDeveloper).not.toContain('First rule.');
  });
});
