const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const { asyncHandler } = require('../middleware/async-handler');
const { extractPassword } = require('../middleware/auth');
const { hasPassword, setPassword, verifyPassword } = require('../../ui-auth');
const { writeText } = require('../../storage');

const CONFIG_FILE_NAME = 'config.toml';

function getConfigPath(orchestrator) {
  return path.join(orchestrator.codexHome, CONFIG_FILE_NAME);
}

function createSettingsRouter(orchestrator) {
  const router = express.Router();

  router.get(
    '/settings/password',
    asyncHandler(async (_req, res) => {
      const passwordSet = await hasPassword(orchestrator);
      res.json({ hasPassword: passwordSet });
    })
  );

  router.post(
    '/settings/auth',
    asyncHandler(async (req, res) => {
      const { password } = req.body || {};
      const ok = await verifyPassword(orchestrator, password);
      if (!ok) {
        return res.status(401).send('Invalid password');
      }
      res.status(204).send();
    })
  );

  router.post(
    '/settings/password',
    asyncHandler(async (req, res) => {
      const { password, currentPassword } = req.body || {};
      if (!password || typeof password !== 'string') {
        return res.status(400).send('password is required');
      }
      const trimmed = password.trim();
      if (trimmed.length < 4) {
        return res.status(400).send('password must be at least 4 characters');
      }
      const passwordSet = await hasPassword(orchestrator);
      if (passwordSet) {
        const provided = currentPassword || extractPassword(req);
        const ok = await verifyPassword(orchestrator, provided);
        if (!ok) {
          return res.status(401).send('Invalid password');
        }
      }
      await setPassword(orchestrator, trimmed);
      res.status(204).send();
    })
  );

  router.get('/settings/config', asyncHandler(async (_req, res) => {
    try {
      const content = await fs.readFile(getConfigPath(orchestrator), 'utf8');
      res.json({ content });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.json({ content: '' });
      }
      throw error;
    }
  }));

  router.post('/settings/config', asyncHandler(async (req, res) => {
    const { content } = req.body || {};
    if (typeof content !== 'string') {
      return res.status(400).send('config content is required');
    }
    await writeText(getConfigPath(orchestrator), content);
    res.status(204).send();
  }));

  router.get('/settings/setup', asyncHandler(async (_req, res) => {
    const setup = await orchestrator.getSetupStatus();
    res.json(setup);
  }));

  router.get('/settings/git', asyncHandler(async (_req, res) => {
    const setup = await orchestrator.getSetupStatus();
    res.json({
      tokenConfigured: setup.gitTokenConfigured,
      gitUserName: setup.gitUserName,
      gitUserEmail: setup.gitUserEmail
    });
  }));

  router.post('/settings/git', asyncHandler(async (req, res) => {
    const { token } = req.body || {};
    if (typeof token !== 'string') {
      return res.status(400).send('token is required');
    }
    const setup = await orchestrator.setGitToken(token);
    res.json(setup);
  }));

  return router;
}

module.exports = {
  createSettingsRouter
};
