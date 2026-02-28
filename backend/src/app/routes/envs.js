const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { normalizeEnvVarsInput } = require('../validators');

function createEnvsRouter(orchestrator) {
  const router = express.Router();

  router.get('/envs', asyncHandler(async (req, res) => {
    const envs = await orchestrator.listEnvs();
    res.json(envs);
  }));

  router.post('/envs', asyncHandler(async (req, res) => {
    const { repoUrl, defaultBranch, envVars } = req.body;
    if (!repoUrl || !defaultBranch) {
      return res.status(400).send('repoUrl and defaultBranch are required');
    }
    let normalizedEnvVars = {};
    try {
      normalizedEnvVars = normalizeEnvVarsInput(envVars) || {};
    } catch (error) {
      return res.status(400).send(error.message || 'Invalid env input');
    }
    const env = await orchestrator.createEnv({ repoUrl, defaultBranch, envVars: normalizedEnvVars });
    res.status(201).json(env);
  }));

  router.delete('/envs/:envId', asyncHandler(async (req, res) => {
    await orchestrator.deleteEnv(req.params.envId);
    res.status(204).send();
  }));

  router.patch('/envs/:envId', asyncHandler(async (req, res) => {
    const { defaultBranch, envVars } = req.body;
    if (defaultBranch === undefined && envVars === undefined) {
      return res.status(400).send('defaultBranch or envVars is required');
    }
    const envId = req.params.envId;
    if (!(await orchestrator.envExists(envId))) {
      return res.status(404).send('Environment not found');
    }
    let normalizedEnvVars;
    if (envVars !== undefined) {
      try {
        normalizedEnvVars = normalizeEnvVarsInput(envVars) || {};
      } catch (error) {
        return res.status(400).send(error.message || 'Invalid env input');
      }
    }
    if (defaultBranch !== undefined) {
      const trimmed = typeof defaultBranch === 'string' ? defaultBranch.trim() : '';
      if (!trimmed) {
        return res.status(400).send('defaultBranch is required');
      }
      const env = await orchestrator.updateEnv(envId, {
        defaultBranch: trimmed,
        envVars: normalizedEnvVars
      });
      return res.json(env);
    }
    const env = await orchestrator.updateEnv(envId, { envVars: normalizedEnvVars });
    return res.json(env);
  }));

  return router;
}

module.exports = {
  createEnvsRouter
};
