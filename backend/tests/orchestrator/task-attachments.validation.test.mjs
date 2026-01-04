import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator task attachment validation', () => {
  it('rejects invalid attachment removal payloads', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

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

    await expect(orchestrator.removeTaskAttachments(task.taskId, [])).rejects.toMatchObject({
      code: 'INVALID_ATTACHMENT'
    });
  });

  it('rejects uploads outside the staging area and ignores unsafe removals', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

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

    await expect(
      orchestrator.prepareTaskAttachments(task.taskId, [
        { path: '/tmp/not-staged.txt', originalName: 'not-staged.txt' }
      ])
    ).rejects.toMatchObject({ code: 'INVALID_ATTACHMENT' });

    const outsidePath = path.join(orchHome, 'outside.txt');
    await fs.writeFile(outsidePath, 'outside');
    const metaPath = orchestrator.taskMetaPath(task.taskId);
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    meta.attachments = [
      {
        name: 'outside.txt',
        originalName: 'outside.txt',
        path: outsidePath,
        size: 7
      }
    ];
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    await orchestrator.removeTaskAttachments(task.taskId, ['outside.txt']);
    const stillThere = await fs.readFile(outsidePath, 'utf8');
    expect(stillThere).toBe('outside');
  });

  it('rejects missing staging files and invalid removal inputs', async () => {
    const orchHome = await createTempDir();
    const exec = createMockExec({ branches: ['main'] });
    const spawn = createMockSpawn();
    const orchestrator = new Orchestrator({
      orchHome,
      codexHome: path.join(orchHome, 'codex-home'),
      exec,
      spawn
    });

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

    const missingPath = path.join(orchestrator.uploadsDir(), 'missing.txt');
    await expect(
      orchestrator.prepareTaskAttachments(task.taskId, [
        { path: missingPath, originalName: 'missing.txt' }
      ])
    ).rejects.toMatchObject({ code: 'INVALID_ATTACHMENT' });

    await expect(orchestrator.removeTaskAttachments(task.taskId, null)).rejects.toMatchObject({
      code: 'INVALID_ATTACHMENT'
    });
  });
});
