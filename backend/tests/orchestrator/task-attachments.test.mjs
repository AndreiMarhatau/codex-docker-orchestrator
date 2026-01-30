import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');
const { MAX_TASK_FILES } = require('../../src/orchestrator/tasks/attachments');

describe('Orchestrator task attachments', () => {
  it('mounts task files and injects attachments instructions', async () => {
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

    await fs.mkdir(orchestrator.uploadsDir(), { recursive: true });
    const uploadPath = path.join(orchestrator.uploadsDir(), 'notes.txt');
    await fs.writeFile(uploadPath, 'notes');

    const task = await orchestrator.createTask({
      envId: env.envId,
      ref: 'main',
      prompt: 'Do work',
      fileUploads: [
        {
          path: uploadPath,
          originalName: 'notes.txt',
          size: 5,
          mimeType: 'text/plain'
        }
      ]
    });
    await waitForTaskStatus(orchestrator, task.taskId, 'completed');

    const attachmentsDir = orchestrator.taskAttachmentsDir(task.taskId);
    expect(task.attachments).toHaveLength(1);
    expect(task.attachments[0].path.startsWith(attachmentsDir)).toBe(true);

    const runCall = spawn.calls.find((call) => call.command === 'codex-docker');
    const mountRw = runCall.options?.env?.CODEX_MOUNT_PATHS || '';
    const mountRo = runCall.options?.env?.CODEX_MOUNT_PATHS_RO || '';
    expect(mountRw.split(':')).toContain(orchestrator.taskHomeDir(task.taskId));
    expect(mountRo.split(':')).toContain(attachmentsDir);

    const agentsFile = runCall.options?.env?.CODEX_AGENTS_APPEND_FILE;
    const agentsContent = await fs.readFile(agentsFile, 'utf8');
    expect(agentsContent).toContain('User-uploaded files');
    expect(agentsContent).toContain(
      path.join(orchestrator.taskHomeDir(task.taskId), 'uploads', 'notes.txt')
    );
  });

  it('dedupes attachment filenames and validates limits', async () => {
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
    const firstUpload = path.join(orchestrator.uploadsDir(), 'report.txt');
    await fs.writeFile(firstUpload, 'one');
    await orchestrator.addTaskAttachments(task.taskId, [
      {
        path: firstUpload,
        originalName: 'report.txt',
        size: 3,
        mimeType: 'text/plain'
      }
    ]);

    const secondUpload = path.join(orchestrator.uploadsDir(), 'report.txt');
    await fs.writeFile(secondUpload, 'two');
    const updated = await orchestrator.addTaskAttachments(task.taskId, [
      {
        path: secondUpload,
        originalName: 'report.txt',
        size: 3,
        mimeType: 'text/plain'
      }
    ]);

    expect(updated).toHaveLength(2);
    expect(updated[0].name).toBe('report.txt');
    expect(updated[1].name).not.toBe('report.txt');

    await expect(
      orchestrator.prepareTaskAttachments(task.taskId, new Array(MAX_TASK_FILES + 1).fill({}))
    ).rejects.toMatchObject({ code: 'INVALID_ATTACHMENT' });
  });


});
