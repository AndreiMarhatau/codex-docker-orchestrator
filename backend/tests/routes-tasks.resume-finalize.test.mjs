import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir, prepareOrchestratorSetup } from './helpers.mjs';
import { waitForTaskIdle } from './helpers/wait.mjs';

const require = createRequire(import.meta.url);
const fsPromises = require('node:fs/promises');
const { createApp } = require('../src/app');
const { Orchestrator } = require('../src/orchestrator');

async function createTestContext() {
  const orchHome = await createTempDir();
  const orchestrator = new Orchestrator({
    orchHome,
    codexHome: `${orchHome}/codex-home`,
    exec: createMockExec({ branches: ['main'] }),
    spawn: createMockSpawn()
  });
  await prepareOrchestratorSetup(orchestrator);
  return { app: await createApp({ orchestrator }), orchestrator };
}

async function waitForTaskStatus(orchestrator, taskId, status) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const task = await orchestrator.getTask(taskId);
    if (task.status === status) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${status}`);
}

async function createUploadInfo(orchestrator, name, contents = name) {
  const uploadPath = path.join(orchestrator.uploadsDir(), `${Date.now()}-${name}`);
  await fs.mkdir(orchestrator.uploadsDir(), { recursive: true });
  await fs.writeFile(uploadPath, contents);
  return {
    path: uploadPath,
    originalName: name,
    size: Buffer.byteLength(contents),
    mimeType: 'text/plain'
  };
}

describe('tasks resume finalize failures', () => {
  it('keeps the started continuation and staged attachments when cleanup fails after resume', async () => {
    const { app, orchestrator } = await createTestContext();
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
    await waitForTaskIdle(orchestrator, task.taskId);
    const [existingAttachment] = await orchestrator.addTaskAttachments(task.taskId, [
      await createUploadInfo(orchestrator, 'existing.txt', 'existing attachment')
    ]);

    const originalRm = fsPromises.rm;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fsPromises.rm = async (targetPath, options) => {
      if (path.basename(targetPath).startsWith('.resume-attachments-')) {
        throw new Error('backup cleanup failed');
      }
      return originalRm(targetPath, options);
    };

    try {
      const response = await request(app)
        .post(`/api/tasks/${task.taskId}/resume`)
        .send({
          prompt: 'Continue',
          attachmentRemovals: [existingAttachment.name]
        })
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({ taskId: task.taskId }));
      expect(['running', 'completed']).toContain(response.body.status);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to finalize resume attachment cleanup for ${task.taskId}`)
      );

      const updated = await orchestrator.getTask(task.taskId);
      expect(updated.attachments).toEqual([]);
      expect(updated.runs).toHaveLength(2);
      await expect(
        fs.access(path.join(orchestrator.taskAttachmentsDir(task.taskId), existingAttachment.name))
      ).rejects.toMatchObject({ code: 'ENOENT' });
      const taskDirEntries = await fs.readdir(orchestrator.taskDir(task.taskId));
      const backupDirName = taskDirEntries.find((entry) => entry.startsWith('.resume-attachments-'));
      expect(backupDirName).toBeTruthy();
      await expect(
        fs.access(path.join(orchestrator.taskDir(task.taskId), backupDirName, existingAttachment.name))
      ).resolves.toBeUndefined();
    } finally {
      fsPromises.rm = originalRm;
      consoleError.mockRestore();
    }
  });
});
