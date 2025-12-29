const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');

function createSettingsRouter(orchestrator) {
  const router = express.Router();

  router.get('/settings/image', asyncHandler(async (req, res) => {
    const info = await orchestrator.getImageInfo();
    res.json(info);
  }));

  router.post('/settings/image/pull', asyncHandler(async (req, res) => {
    const info = await orchestrator.pullImage();
    res.json(info);
  }));

  return router;
}

module.exports = {
  createSettingsRouter
};
