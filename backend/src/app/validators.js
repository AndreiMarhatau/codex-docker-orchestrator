const path = require('node:path');

function isSupportedImageFile(file) {
  const mimeType = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp'
  ]);
  const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
  return allowedMimeTypes.has(mimeType) || allowedExts.has(ext);
}

function normalizeContextReposInput(contextRepos) {
  if (contextRepos === undefined) {
    return null;
  }
  if (!Array.isArray(contextRepos)) {
    throw new Error('contextRepos must be an array');
  }
  return contextRepos.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`contextRepos[${index}] must be an object`);
    }
    const envId = typeof entry.envId === 'string' ? entry.envId.trim() : '';
    if (!envId) {
      throw new Error(`contextRepos[${index}].envId is required`);
    }
    const ref = typeof entry.ref === 'string' ? entry.ref.trim() : '';
    return ref ? { envId, ref } : { envId };
  });
}

function normalizeAttachmentUploadsInput(fileUploads) {
  if (fileUploads === undefined) {
    return null;
  }
  if (!Array.isArray(fileUploads)) {
    throw new Error('fileUploads must be an array');
  }
  return fileUploads.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`fileUploads[${index}] must be an object`);
    }
    const uploadPath = typeof entry.path === 'string' ? entry.path.trim() : '';
    if (!uploadPath) {
      throw new Error(`fileUploads[${index}].path is required`);
    }
    const originalName = typeof entry.originalName === 'string' ? entry.originalName.trim() : '';
    const size = Number.isFinite(entry.size) ? entry.size : null;
    const mimeType = typeof entry.mimeType === 'string' ? entry.mimeType.trim() : '';
    return {
      path: uploadPath,
      originalName: originalName || null,
      size,
      mimeType: mimeType || null
    };
  });
}

module.exports = {
  isSupportedImageFile,
  normalizeAttachmentUploadsInput,
  normalizeContextReposInput
};
