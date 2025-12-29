const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');

function createEnvsRouter(orchestrator) {
  const router = express.Router();

  router.get('/envs', asyncHandler(async (req, res) => {
    const envs = await orchestrator.listEnvs();
    res.json(envs);
  }));

  router.post('/envs', asyncHandler(async (req, res) => {
    const { repoUrl, defaultBranch } = req.body;
    if (!repoUrl || !defaultBranch) {
      return res.status(400).send('repoUrl and defaultBranch are required');
    }
    const env = await orchestrator.createEnv({ repoUrl, defaultBranch });
    res.status(201).json(env);
  }));

  router.delete('/envs/:envId', asyncHandler(async (req, res) => {
    await orchestrator.deleteEnv(req.params.envId);
    res.status(204).send();
  }));

  return router;
}

module.exports = {
  createEnvsRouter
};
