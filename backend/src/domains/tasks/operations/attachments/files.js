const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathExists } = require('../../../../shared/filesystem/storage');
const { invalidAttachmentError } = require('../../../../orchestrator/errors');

function sanitizeFilename(name) {
  const base = path.basename(name || '').trim();
  return base ? base.replace(/[^a-zA-Z0-9._-]/g, '_') : null;
}

async function ensureUniqueFilename(dir, name) {
  const parsed = path.parse(name);
  let candidate = name;
  let counter = 1;
  while (await pathExists(path.join(dir, candidate))) {
    candidate = `${parsed.name}-${counter}${parsed.ext}`;
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
  try {
    const stat = await fsp.stat(resolvedPath);
    if (!stat.isFile()) {
      throw invalidAttachmentError(`File not found: ${uploadPath}`);
    }
    return {
      path: resolvedPath,
      originalName: typeof upload?.originalName === 'string' ? upload.originalName : null,
      size: Number.isFinite(upload?.size) ? upload.size : stat.size,
      mimeType: typeof upload?.mimeType === 'string' ? upload.mimeType : null
    };
  } catch (error) {
    if (error.code === 'INVALID_ATTACHMENT') {
      throw error;
    }
    throw invalidAttachmentError(`File not found: ${uploadPath}`);
  }
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

module.exports = {
  buildAttachmentEntry,
  ensureUniqueFilename,
  moveFile,
  resolveUpload,
  sanitizeFilename
};
