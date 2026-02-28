const express = require('express');
const cors = require('cors');
const { EventEmitter } = require('node:events');
const { Orchestrator } = require('./orchestrator');
const { createAuthMiddleware } = require('./app/middleware/auth');
const { createHealthRouter } = require('./app/routes/health');
const { createEnvsRouter } = require('./app/routes/envs');
const { createAccountsRouter } = require('./app/routes/accounts');
const { createUploadsRouter } = require('./app/routes/uploads');
const { createTasksRouter } = require('./app/routes/tasks');
const { createSettingsRouter } = require('./app/routes/settings');
const { createEventsRouter } = require('./app/routes/events');

function createApp({ orchestrator = new Orchestrator() } = {}) {
  const app = express();
  const stateEvents = new EventEmitter();
  const emitStateEvent = (event, data = {}) => {
    stateEvents.emit('state', { event, data });
  };
  const subscribeStateEvents = (listener) => {
    stateEvents.on('state', listener);
    return () => {
      stateEvents.off('state', listener);
    };
  };

  orchestrator.emitStateEvent = emitStateEvent;
  orchestrator.subscribeStateEvents = subscribeStateEvents;

  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Orch-Password']
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', createAuthMiddleware(orchestrator));
  app.use('/api', createHealthRouter());
  app.use('/api', createEventsRouter(orchestrator));
  app.use('/api', createSettingsRouter(orchestrator));
  app.use('/api', createEnvsRouter(orchestrator));
  app.use('/api', createAccountsRouter(orchestrator));
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
