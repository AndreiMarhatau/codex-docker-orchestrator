const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { MAX_TASK_FILES } = require('../orchestrator/tasks/attachments');

const MAX_TASK_FILE_SIZE = 10 * 1024 * 1024;

function createStorage(orchestrator) {
  return multer.diskStorage({
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
}

function createFileUploadMiddleware(orchestrator) {
  const storage = createStorage(orchestrator);
  return multer({
    storage,
    limits: {
      files: MAX_TASK_FILES,
      fileSize: MAX_TASK_FILE_SIZE
    }
  });
}

module.exports = {
  MAX_TASK_FILE_SIZE,
  createFileUploadMiddleware
};
