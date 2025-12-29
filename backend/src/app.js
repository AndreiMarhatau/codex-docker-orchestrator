const express = require('express');
const cors = require('cors');
const { Orchestrator } = require('./orchestrator');
const { createHealthRouter } = require('./app/routes/health');
const { createEnvsRouter } = require('./app/routes/envs');
const { createAccountsRouter } = require('./app/routes/accounts');
const { createSettingsRouter } = require('./app/routes/settings');
const { createUploadsRouter } = require('./app/routes/uploads');
const { createTasksRouter } = require('./app/routes/tasks');

function createApp({ orchestrator = new Orchestrator() } = {}) {
  const app = express();
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type']
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', createHealthRouter());
  app.use('/api', createEnvsRouter(orchestrator));
  app.use('/api', createAccountsRouter(orchestrator));
  app.use('/api', createSettingsRouter(orchestrator));
  app.use('/api', createUploadsRouter(orchestrator));
  app.use('/api', createTasksRouter(orchestrator));

  app.use((err, req, res, _next) => {
    const message = err && err.message ? err.message : 'Internal error';
    res.status(500).send(message);
  });

  return app;
}

module.exports = {
  createApp
};
