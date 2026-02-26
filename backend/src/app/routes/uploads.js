const express = require('express');
const { createFileUploadMiddleware } = require('../uploads');

function createUploadsRouter(orchestrator) {
  const router = express.Router();
  const uploadFiles = createFileUploadMiddleware(orchestrator);

  router.post('/uploads/files', (req, res) => {
    uploadFiles.array('files')(req, res, (error) => {
      if (error) {
        return res.status(400).send(error.message || 'Upload failed.');
      }
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).send('No files uploaded.');
      }
      const uploads = files.map((file) => ({
        path: file.path,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      }));
      res.status(201).json({ uploads });
    });
  });

  return router;
}

module.exports = {
  createUploadsRouter
};
