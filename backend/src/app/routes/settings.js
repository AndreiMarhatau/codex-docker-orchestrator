const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');
const { extractPassword } = require('../middleware/auth');
const { hasPassword, setPassword, verifyPassword } = require('../../ui-auth');

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

  return router;
}

module.exports = {
  createSettingsRouter
};
