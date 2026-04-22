const path = require('node:path');
const fsp = require('node:fs/promises');
const { ensureDir, readJson, removePath, writeJson } = require('../../storage');

async function moveFile(sourcePath, targetPath) {
  try {
    await fsp.rename(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== 'EXDEV') {
      throw error;
    }
    await fsp.copyFile(sourcePath, targetPath);
    await fsp.unlink(sourcePath);
  }
}

async function cleanupAddedAttachments(attachmentsDir, originalNames) {
  let entries = [];
  try {
    entries = await fsp.readdir(attachmentsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || originalNames.has(entry.name)) {
      return;
    }
    await removePath(path.join(attachmentsDir, entry.name));
  }));
}

async function restoreRemovedAttachments(movedAttachments) {
  for (const moved of movedAttachments) {
    await moveFile(moved.backupPath, moved.originalPath);
  }
}

async function writeAttachmentsMeta(orchestrator, taskId, attachments) {
  const metaPath = orchestrator.taskMetaPath(taskId);
  const meta = await readJson(metaPath);
  meta.attachments = attachments;
  meta.updatedAt = orchestrator.now();
  await writeJson(metaPath, meta);
  orchestrator.notifyTasksChanged(taskId);
}

async function rollbackResumeAttachmentStage({
  attachmentsDir,
  backupDir,
  movedAttachments,
  originalAttachments,
  orchestrator,
  taskId
}) {
  const originalNames = new Set(originalAttachments.map((attachment) => attachment.name));
  await cleanupAddedAttachments(attachmentsDir, originalNames);
  await restoreRemovedAttachments(movedAttachments);
  await writeAttachmentsMeta(orchestrator, taskId, originalAttachments);
  if (backupDir) {
    await removePath(backupDir);
  }
}

const NOOP_RESUME_ATTACHMENT_STAGE = {
  finalize: async () => {},
  rollback: async () => {}
};

async function rollbackFailedResumeStage(stagedAttachments, error) {
  try {
    await stagedAttachments.rollback();
  } catch (rollbackError) {
    const combinedError = new AggregateError(
      [error, rollbackError],
      'Resume failed and staged attachment changes could not be rolled back.'
    );
    combinedError.cause = error;
    throw combinedError;
  }
}

function logResumeAttachmentFinalizeFailure(taskId, error) {
  console.error(
    `Failed to finalize resume attachment cleanup for ${taskId}: ${error?.message || 'Unknown error'}`
  );
}

async function finalizeStartedResumeStage(stagedAttachments, taskId) {
  try {
    await stagedAttachments.finalize();
  } catch (error) {
    logResumeAttachmentFinalizeFailure(taskId, error);
  }
}

async function stageResumeAttachments(orchestrator, taskId, input) {
  const hasAttachmentChanges =
    (input.hasAttachmentRemovals && input.attachmentRemovals.length > 0) ||
    (input.hasFileUploads && input.fileUploads.length > 0);

  if (!hasAttachmentChanges) {
    return NOOP_RESUME_ATTACHMENT_STAGE;
  }

  const attachmentsDir = orchestrator.taskAttachmentsDir(taskId);
  const meta = await readJson(orchestrator.taskMetaPath(taskId));
  const originalAttachments = Array.isArray(meta.attachments) ? meta.attachments : [];
  const removalSet = new Set(input.attachmentRemovals || []);
  const movedAttachments = [];
  const backupDir =
    removalSet.size > 0
      ? path.join(orchestrator.taskDir(taskId), `.resume-attachments-${Date.now()}`)
      : '';

  try {
    if (backupDir) {
      await ensureDir(backupDir);
    }
    const retainedAttachments = [];
    for (const attachment of originalAttachments) {
      if (!removalSet.has(attachment.name)) {
        retainedAttachments.push(attachment);
        continue;
      }
      const originalPath = path.resolve(attachment.path);
      const backupPath = path.join(backupDir, attachment.name);
      await moveFile(originalPath, backupPath);
      movedAttachments.push({ backupPath, originalPath });
    }
    const nextAttachments = await orchestrator.prepareTaskAttachments(
      taskId,
      input.fileUploads,
      retainedAttachments
    );
    await writeAttachmentsMeta(orchestrator, taskId, nextAttachments);
  } catch (error) {
    await rollbackResumeAttachmentStage({
      attachmentsDir,
      backupDir,
      movedAttachments,
      originalAttachments,
      orchestrator,
      taskId
    }).catch(() => {});
    throw error;
  }

  return {
    finalize: async () => {
      if (backupDir) {
        await removePath(backupDir);
      }
    },
    rollback: async () => {
      await rollbackResumeAttachmentStage({
        attachmentsDir,
        backupDir,
        movedAttachments,
        originalAttachments,
        orchestrator,
        taskId
      });
    }
  };
}

module.exports = {
  finalizeStartedResumeStage,
  NOOP_RESUME_ATTACHMENT_STAGE,
  rollbackFailedResumeStage,
  stageResumeAttachments
};
