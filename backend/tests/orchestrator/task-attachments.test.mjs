import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir } from '../helpers.mjs';
import { waitForTaskStatus } from '../helpers/wait.mjs';

const require = createRequire(import.meta.url);
const { Orchestrator } = require('../../src/orchestrator');
const { MAX_TASK_FILES } = require('../../src/orchestrator/tasks/attachments');

function extractDeveloperInstructions(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === '-c' || arg === '--config') && typeof args[index + 1] === 'string') {
      const value = args[index + 1];
      if (value.startsWith('developer_instructions=')) {
        return JSON.parse(value.slice('developer_instructions='.length));
      }
    }
    if (typeof arg === 'string' && arg.startsWith('--config=developer_instructions=')) {
      return JSON.parse(arg.slice('--config=developer_instructions='.length));
    }
  }
  return null;
}

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
    const mountRo = runCall.options?.env?.CODEX_MOUNT_PATHS_RO || '';
    const mountMapsRo = runCall.options?.env?.CODEX_MOUNT_MAPS_RO || '';
    expect(mountRo).toBe('');
    expect(mountMapsRo.split(':')).toContain(`${attachmentsDir}=/attachments`);

    const developerInstructions = extractDeveloperInstructions(runCall.args);
    expect(developerInstructions).toContain('User-uploaded files');
    expect(developerInstructions).toContain('/attachments/notes.txt');
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
