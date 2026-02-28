const express = require('express');
const { STATE_EVENT_TYPES } = require('../state-event-types');
const { buildStateSnapshot } = require('../state-snapshot');

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamStateEvents(orchestrator, req, res) {
  let initSent = false;
  let closed = false;
  const pendingEvents = [];
  const listener = (message) => {
    if (closed) {
      return;
    }
    if (!message?.event) {
      return;
    }
    if (!initSent) {
      pendingEvents.push(message);
      return;
    }
    writeEvent(res, message.event, message.data || {});
  };
  const unsubscribe = orchestrator.subscribeStateEvents(listener);
  const cleanup = () => {
    if (closed) {
      return;
    }
    closed = true;
    unsubscribe();
    req.off('close', cleanup);
  };
  req.on('close', cleanup);

  try {
    const snapshot = await buildStateSnapshot(orchestrator);
    if (closed) {
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    writeEvent(res, STATE_EVENT_TYPES.init, snapshot);
    initSent = true;
    for (const message of pendingEvents) {
      if (closed) {
        return;
      }
      writeEvent(res, message.event, message.data || {});
    }
  } catch (error) {
    cleanup();
    throw error;
  }
}

function createEventsRouter(orchestrator) {
  const router = express.Router();

  router.get('/events/stream', async (req, res, next) => {
    try {
      await streamStateEvents(orchestrator, req, res);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createEventsRouter,
  streamStateEvents
};
