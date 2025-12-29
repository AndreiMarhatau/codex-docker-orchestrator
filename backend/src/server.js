const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { createApp } = require('./app');

function startServer({
  app = null,
  port = null,
  uiDistPath = null,
  expressLib = express,
  fsLib = fs,
  createAppFn = createApp
} = {}) {
  const resolvedPort = port ?? (process.env.ORCH_PORT ? Number(process.env.ORCH_PORT) : 8080);
  const serverApp = app || createAppFn();
  const uiDist = uiDistPath || path.resolve(__dirname, '../../ui/dist');

  if (expressLib.static && fsLib.existsSync(uiDist)) {
    serverApp.use(expressLib.static(uiDist));
    serverApp.get('*', (req, res) => {
      res.sendFile(path.join(uiDist, 'index.html'));
    });
  }

  return serverApp.listen(resolvedPort, () => {
    console.log(`Orchestrator backend listening on :${resolvedPort}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
