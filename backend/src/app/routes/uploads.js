const express = require('express');
const { createUploadMiddleware } = require('../uploads');

function createUploadsRouter(orchestrator) {
  const router = express.Router();
  const upload = createUploadMiddleware(orchestrator);

  router.post('/uploads', (req, res) => {
    upload.array('images', 5)(req, res, (error) => {
      if (error) {
        return res.status(400).send(error.message || 'Upload failed.');
      }
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).send('No images uploaded.');
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
