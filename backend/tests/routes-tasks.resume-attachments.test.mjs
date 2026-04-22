import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createTempDir } from './helpers.mjs';

const require = createRequire(import.meta.url);
const fsPromises = require('node:fs/promises');
const { stageResumeAttachments } = require('../src/app/routes/tasks.resume-attachments');

function createOrchestratorStub(rootDir) {
  const now = () => '2026-04-22T00:00:00.000Z';

  return {
    now,
    notifyTasksChanged: vi.fn(),
    taskDir: (taskId) => path.join(rootDir, 'tasks', taskId),
    taskAttachmentsDir: (taskId) => path.join(rootDir, 'tasks', taskId, 'attachments'),
    taskMetaPath: (taskId) => path.join(rootDir, 'tasks', taskId, 'meta.json'),
    prepareTaskAttachments: async (taskId, uploads, existing) => {
      const attachmentsDir = path.join(rootDir, 'tasks', taskId, 'attachments');
      const attachments = [...existing];
      for (const upload of uploads) {
        const targetPath = path.join(attachmentsDir, upload.originalName);
        await fs.rename(upload.path, targetPath);
        attachments.push({
          name: upload.originalName,
          originalName: upload.originalName,
          path: targetPath
        });
      }
      return attachments;
    }
  };
}

async function writeTaskMeta(orchestrator, taskId, attachments = []) {
  const taskDir = orchestrator.taskDir(taskId);
  await fs.mkdir(orchestrator.taskAttachmentsDir(taskId), { recursive: true });
  await fs.writeFile(
    orchestrator.taskMetaPath(taskId),
    JSON.stringify({ taskId, attachments, updatedAt: orchestrator.now() })
  );
  return taskDir;
}

async function createUpload(rootDir, name, contents = name) {
  const uploadsDir = path.join(rootDir, 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const uploadPath = path.join(uploadsDir, name);
  await fs.writeFile(uploadPath, contents);
  return {
    path: uploadPath,
    originalName: name
  };
}

describe('stageResumeAttachments', () => {
  it('returns a no-op stage when no attachment changes are requested', async () => {
    const rootDir = await createTempDir();
    const orchestrator = createOrchestratorStub(rootDir);
    await writeTaskMeta(orchestrator, 'task-1');

    const stage = await stageResumeAttachments(orchestrator, 'task-1', {
      attachmentRemovals: [],
      fileUploads: [],
      hasAttachmentRemovals: false,
      hasFileUploads: false
    });

    await expect(stage.finalize()).resolves.toBeUndefined();
    await expect(stage.rollback()).resolves.toBeUndefined();
  });

  it('stages removals and clears the backup directory on finalize', async () => {
    const rootDir = await createTempDir();
    const orchestrator = createOrchestratorStub(rootDir);
    const attachmentPath = path.join(orchestrator.taskAttachmentsDir('task-1'), 'existing.txt');
    await writeTaskMeta(orchestrator, 'task-1', [
      { name: 'existing.txt', originalName: 'existing.txt', path: attachmentPath }
    ]);
    await fs.writeFile(attachmentPath, 'existing');

    const stage = await stageResumeAttachments(orchestrator, 'task-1', {
      attachmentRemovals: ['existing.txt'],
      fileUploads: [],
      hasAttachmentRemovals: true,
      hasFileUploads: false
    });

    const entriesAfterStage = await fs.readdir(orchestrator.taskDir('task-1'));
    expect(entriesAfterStage.some((entry) => entry.startsWith('.resume-attachments-'))).toBe(true);

    await stage.finalize();

    const entriesAfterFinalize = await fs.readdir(orchestrator.taskDir('task-1'));
    expect(entriesAfterFinalize.some((entry) => entry.startsWith('.resume-attachments-'))).toBe(false);
  });

  it('rolls back uploaded attachments when resume startup fails', async () => {
    const rootDir = await createTempDir();
    const orchestrator = createOrchestratorStub(rootDir);
    const attachmentPath = path.join(orchestrator.taskAttachmentsDir('task-1'), 'existing.txt');
    await writeTaskMeta(orchestrator, 'task-1', [
      { name: 'existing.txt', originalName: 'existing.txt', path: attachmentPath }
    ]);
    await fs.writeFile(attachmentPath, 'existing');

    const stage = await stageResumeAttachments(orchestrator, 'task-1', {
      attachmentRemovals: [],
      fileUploads: [await createUpload(rootDir, 'new.txt', 'new')],
      hasAttachmentRemovals: false,
      hasFileUploads: true
    });

    await stage.rollback();

    const restoredMeta = JSON.parse(await fs.readFile(orchestrator.taskMetaPath('task-1'), 'utf8'));
    expect(restoredMeta.attachments).toEqual([
      expect.objectContaining({ name: 'existing.txt', originalName: 'existing.txt' })
    ]);
    await expect(fs.access(attachmentPath)).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(orchestrator.taskAttachmentsDir('task-1'), 'new.txt'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('leaves staged attachment changes in place when finalize cleanup fails', async () => {
    const rootDir = await createTempDir();
    const orchestrator = createOrchestratorStub(rootDir);
    const attachmentPath = path.join(orchestrator.taskAttachmentsDir('task-1'), 'existing.txt');
    await writeTaskMeta(orchestrator, 'task-1', [
      { name: 'existing.txt', originalName: 'existing.txt', path: attachmentPath }
    ]);
    await fs.writeFile(attachmentPath, 'existing');

    const originalRm = fsPromises.rm;
    fsPromises.rm = async (targetPath, options) => {
      if (path.basename(targetPath).startsWith('.resume-attachments-')) {
        throw new Error('backup cleanup failed');
      }
      return originalRm(targetPath, options);
    };

    try {
      const stage = await stageResumeAttachments(orchestrator, 'task-1', {
        attachmentRemovals: ['existing.txt'],
        fileUploads: [],
        hasAttachmentRemovals: true,
        hasFileUploads: false
      });

      await expect(stage.finalize()).rejects.toThrow(/backup cleanup failed/);

      const stagedMeta = JSON.parse(await fs.readFile(orchestrator.taskMetaPath('task-1'), 'utf8'));
      expect(stagedMeta.attachments).toEqual([]);
      await expect(fs.access(attachmentPath)).rejects.toMatchObject({ code: 'ENOENT' });
      const taskDirEntries = await fs.readdir(orchestrator.taskDir('task-1'));
      expect(taskDirEntries.some((entry) => entry.startsWith('.resume-attachments-'))).toBe(true);
    } finally {
      fsPromises.rm = originalRm;
    }
  });
});
