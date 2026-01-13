const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');

function createAccountsRouter(orchestrator) {
  const router = express.Router();

  router.get('/accounts', asyncHandler(async (req, res) => {
    const accounts = await orchestrator.listAccounts();
    res.json(accounts);
  }));

  router.get('/accounts/rate-limits', asyncHandler(async (req, res) => {
    try {
      const limits = await orchestrator.getAccountRateLimits();
      res.json(limits);
    } catch (error) {
      if (error?.code === 'NO_ACTIVE_ACCOUNT') {
        return res.status(400).send(error.message);
      }
      throw error;
    }
  }));

  router.post('/accounts', asyncHandler(async (req, res) => {
    const { label, authJson } = req.body || {};
    if (!authJson || typeof authJson !== 'string') {
      return res.status(400).send('authJson is required');
    }
    try {
      const account = await orchestrator.addAccount({ label, authJson });
      res.status(201).json(account);
    } catch (error) {
      const message = error?.message || 'Invalid authJson';
      if (message.toLowerCase().includes('authjson') || message.toLowerCase().includes('json')) {
        return res.status(400).send(message);
      }
      throw error;
    }
  }));

  router.post('/accounts/:accountId/activate', asyncHandler(async (req, res) => {
    const accounts = await orchestrator.activateAccount(req.params.accountId);
    res.json(accounts);
  }));

  router.post('/accounts/rotate', asyncHandler(async (req, res) => {
    const accounts = await orchestrator.rotateAccount();
    res.json(accounts);
  }));

  router.delete('/accounts/:accountId', asyncHandler(async (req, res) => {
    try {
      const accounts = await orchestrator.removeAccount(req.params.accountId);
      res.json(accounts);
    } catch (error) {
      const message = error?.message || 'Unable to remove account';
      if (message.toLowerCase().includes('active account')) {
        return res.status(400).send(message);
      }
      throw error;
    }
  }));

  router.patch('/accounts/:accountId', asyncHandler(async (req, res) => {
    const { label } = req.body || {};
    if (typeof label !== 'string') {
      return res.status(400).send('label is required');
    }
    const accounts = await orchestrator.updateAccountLabel(req.params.accountId, label);
    res.json(accounts);
  }));

  return router;
}

module.exports = {
  createAccountsRouter
};
