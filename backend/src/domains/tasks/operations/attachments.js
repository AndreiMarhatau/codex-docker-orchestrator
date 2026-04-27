const path = require('node:path');
const { ensureDir, readJson, writeJson, removePath } = require('../../../shared/filesystem/storage');
const { invalidAttachmentError } = require('../../../orchestrator/errors');
const {
  buildAttachmentEntry,
  ensureUniqueFilename,
  moveFile,
  resolveUpload,
  sanitizeFilename
} = require('./attachments/files');

const MAX_TASK_FILES = 10;

function normalizeAttachmentList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((item) => item && typeof item.name === 'string' && typeof item.path === 'string');
}

function validateNames(names) {
  if (!Array.isArray(names)) {
    throw invalidAttachmentError('names must be an array of filenames.');
  }
  const filtered = names
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean);
  if (filtered.length === 0) {
    throw invalidAttachmentError('At least one filename is required.');
  }
  return filtered;
}

function attachTaskAttachmentMethods(Orchestrator) {
  Orchestrator.prototype.prepareTaskAttachments = async function prepareTaskAttachments(
    taskId,
    uploads,
    existing = []
  ) {
    if (!Array.isArray(uploads) || uploads.length === 0) {
      return normalizeAttachmentList(existing);
    }
    if (uploads.length > MAX_TASK_FILES) {
      throw invalidAttachmentError(`Up to ${MAX_TASK_FILES} files can be attached.`);
    }
    const attachmentsDir = this.taskAttachmentsDir(taskId);
    await ensureDir(attachmentsDir);
    const uploadsRoot = path.resolve(this.uploadsDir());
    const resolvedUploads = [];
    for (const upload of uploads) {
      const resolvedUpload = await resolveUpload(uploadsRoot, upload);
      resolvedUploads.push(resolvedUpload);
    }
    const now = this.now();
    const nextAttachments = normalizeAttachmentList(existing);
    if (nextAttachments.length + resolvedUploads.length > MAX_TASK_FILES) {
      throw invalidAttachmentError(`Up to ${MAX_TASK_FILES} files can be attached.`);
    }
    for (const upload of resolvedUploads) {
      const fallbackName = `upload-${path.basename(upload.path)}`;
      const desiredName = sanitizeFilename(upload.originalName) || fallbackName;
      const uniqueName = await ensureUniqueFilename(attachmentsDir, desiredName);
      const targetPath = path.join(attachmentsDir, uniqueName);
      await moveFile(upload.path, targetPath);
      nextAttachments.push(
        buildAttachmentEntry({
          name: uniqueName,
          originalName: upload.originalName,
          path: targetPath,
          size: upload.size,
          mimeType: upload.mimeType,
          now
        })
      );
    }
    return nextAttachments;
  };

  Orchestrator.prototype.addTaskAttachments = async function addTaskAttachments(taskId, uploads) {
    await this.init();
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    try {
      const meta = await this.reconcileTaskRuntimeState(
        taskId,
        await readJson(this.taskMetaPath(taskId))
      );
      const nextAttachments = await this.prepareTaskAttachments(
        taskId,
        uploads,
        meta.attachments
      );
      meta.attachments = nextAttachments;
      meta.updatedAt = this.now();
      await writeJson(this.taskMetaPath(taskId), meta);
      this.notifyTasksChanged(taskId);
      return meta.attachments;
    } finally {
      releaseTaskRunTransition();
    }
  };

  Orchestrator.prototype.removeTaskAttachments = async function removeTaskAttachments(taskId, names) {
    await this.init();
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    try {
      const meta = await this.reconcileTaskRuntimeState(
        taskId,
        await readJson(this.taskMetaPath(taskId))
      );
      const removeNames = validateNames(names);
      const attachmentsDir = this.taskAttachmentsDir(taskId);
      const attachments = normalizeAttachmentList(meta.attachments);
      const remaining = [];
      for (const attachment of attachments) {
        if (!removeNames.includes(attachment.name)) {
          remaining.push(attachment);
          continue;
        }
        const resolvedPath = path.resolve(attachment.path);
        if (
          resolvedPath !== attachmentsDir &&
          resolvedPath.startsWith(`${attachmentsDir}${path.sep}`)
        ) {
          await removePath(resolvedPath);
        }
      }
      meta.attachments = remaining;
      meta.updatedAt = this.now();
      await writeJson(this.taskMetaPath(taskId), meta);
      this.notifyTasksChanged(taskId);
      return meta.attachments;
    } finally {
      releaseTaskRunTransition();
    }
  };
}

module.exports = {
  attachTaskAttachmentMethods,
  MAX_TASK_FILES
};
