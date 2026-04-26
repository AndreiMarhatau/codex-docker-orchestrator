import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { createMockExec, createMockSpawn, createTempDir, prepareOrchestratorSetup } from './helpers.mjs';
import { waitForTaskIdle } from './helpers/wait.mjs';

const require = createRequire(import.meta.url);
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

async function expectResumeAttachmentRollback(orchestrator, taskId, attachment, uploadedName) {
  const task = await orchestrator.getTask(taskId);
  expect(task.attachments).toEqual([
    expect.objectContaining({ name: attachment.name, originalName: attachment.originalName })
  ]);
  await expect(
    fs.access(path.join(orchestrator.taskAttachmentsDir(taskId), attachment.name))
  ).resolves.toBeUndefined();
  await expect(
    fs.access(path.join(orchestrator.taskAttachmentsDir(taskId), uploadedName))
  ).rejects.toMatchObject({ code: 'ENOENT' });
  const entries = await fs.readdir(orchestrator.taskDir(taskId));
  expect(entries.some((entry) => entry.startsWith('.resume-attachments-'))).toBe(false);
}

describe('tasks resume route atomicity', () => {
  it('rolls back staged attachment changes when resume startup fails', async () => {
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

    const metaPath = orchestrator.taskMetaPath(task.taskId);
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    meta.threadId = null;
    await fs.writeFile(metaPath, JSON.stringify(meta));

    const response = await request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({
        prompt: 'Continue',
        attachmentRemovals: [existingAttachment.name],
        fileUploads: [await createUploadInfo(orchestrator, 'new.txt', 'new attachment')]
      })
      .expect(500);

    expect(response.text).toContain('thread_id');
    await expectResumeAttachmentRollback(orchestrator, task.taskId, existingAttachment, 'new.txt');
  });

  it('rolls back staged attachment changes when resume setup fails after auth checks begin', async () => {
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
    orchestrator.ensureActiveAuth = async () => {
      throw new Error('auth unavailable');
    };

    const response = await request(app)
      .post(`/api/tasks/${task.taskId}/resume`)
      .send({
        prompt: 'Continue',
        attachmentRemovals: [existingAttachment.name],
        fileUploads: [await createUploadInfo(orchestrator, 'auth-failure.txt', 'new attachment')]
      })
      .expect(500);

    expect(response.text).toContain('auth unavailable');
    await expectResumeAttachmentRollback(
      orchestrator,
      task.taskId,
      existingAttachment,
      'auth-failure.txt'
    );
  });
});
