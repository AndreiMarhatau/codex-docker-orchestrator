const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { isSupportedImageFile } = require('./validators');

function createUploadMiddleware(orchestrator) {
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await fs.mkdir(orchestrator.uploadsDir(), { recursive: true });
        cb(null, orchestrator.uploadsDir());
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  });
  return multer({
    storage,
    limits: {
      files: 5,
      fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      if (isSupportedImageFile(file)) {
        cb(null, true);
      } else {
        cb(new Error('Only png, jpg, gif, webp, or bmp images are supported.'));
      }
    }
  });
}

module.exports = {
  createUploadMiddleware
};
