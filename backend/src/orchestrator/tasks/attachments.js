const path = require('node:path');
const fsp = require('node:fs/promises');
const { ensureDir, pathExists, readJson, writeJson, removePath } = require('../../storage');
const { invalidAttachmentError } = require('../errors');

const MAX_TASK_FILES = 10;

function sanitizeFilename(name) {
  const base = path.basename(name || '').trim();
  if (!base) {
    return null;
  }
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureUniqueFilename(dir, name) {
  const parsed = path.parse(name);
  let candidate = name;
  let counter = 1;
  while (await pathExists(path.join(dir, candidate))) {
    const suffix = `-${counter}`;
    candidate = `${parsed.name}${suffix}${parsed.ext}`;
    counter += 1;
  }
  return candidate;
}

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

async function resolveUpload(uploadsRoot, upload) {
  const uploadPath = typeof upload?.path === 'string' ? upload.path : '';
  if (!uploadPath.trim()) {
    throw invalidAttachmentError('Invalid file upload path provided.');
  }
  const resolvedPath = path.resolve(uploadPath);
  if (resolvedPath === uploadsRoot || !resolvedPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw invalidAttachmentError('Files must be uploaded via orchestrator before use.');
  }
  let stat;
  try {
    stat = await fsp.stat(resolvedPath);
  } catch (error) {
    throw invalidAttachmentError(`File not found: ${uploadPath}`);
  }
  if (!stat.isFile()) {
    throw invalidAttachmentError(`File not found: ${uploadPath}`);
  }
  return {
    path: resolvedPath,
    originalName: typeof upload?.originalName === 'string' ? upload.originalName : null,
    size: Number.isFinite(upload?.size) ? upload.size : stat.size,
    mimeType: typeof upload?.mimeType === 'string' ? upload.mimeType : null
  };
}

function buildAttachmentEntry({ name, originalName, path: filePath, size, mimeType, now }) {
  return {
    name,
    originalName: originalName || name,
    path: filePath,
    size: Number.isFinite(size) ? size : null,
    mimeType: mimeType || null,
    uploadedAt: now
  };
}

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
    const meta = await readJson(this.taskMetaPath(taskId));
    const nextAttachments = await this.prepareTaskAttachments(
      taskId,
      uploads,
      meta.attachments
    );
    meta.attachments = nextAttachments;
    meta.updatedAt = this.now();
    await writeJson(this.taskMetaPath(taskId), meta);
    if (typeof this.emitStateEvent === 'function') {
      this.emitStateEvent('tasks_changed', { taskId });
    }
    return meta.attachments;
  };

  Orchestrator.prototype.removeTaskAttachments = async function removeTaskAttachments(taskId, names) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
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
    if (typeof this.emitStateEvent === 'function') {
      this.emitStateEvent('tasks_changed', { taskId });
    }
    return meta.attachments;
  };
}

module.exports = {
  attachTaskAttachmentMethods,
  MAX_TASK_FILES
};
