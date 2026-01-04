import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');

describe('Orchestrator task attachment removal', () => {
  it('removes attachments stored in the attachments directory', async () => {
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

    await fs.mkdir(orchestrator.uploadsDir(), { recursive: true });
    const uploadPath = path.join(orchestrator.uploadsDir(), 'keep.txt');
    await fs.writeFile(uploadPath, 'remove-me');
    const attachments = await orchestrator.addTaskAttachments(task.taskId, [
      {
        path: uploadPath,
        originalName: '',
        size: Number.NaN,
        mimeType: ''
      }
    ]);

    expect(attachments).toHaveLength(1);
    const storedPath = attachments[0].path;
    await orchestrator.removeTaskAttachments(task.taskId, [attachments[0].name]);
    await expect(fs.stat(storedPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
