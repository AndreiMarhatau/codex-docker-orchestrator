const fs = require('node:fs');
const path = require('node:path');

function createRateLimitPayloads() {
  const initRequestId = 1;
  const rateLimitRequestId = 2;
  const initPayload = {
    method: 'initialize',
    id: initRequestId,
    params: {
      clientInfo: {
        name: 'codex-docker-orchestrator',
        title: 'Codex Docker Orchestrator',
        version: '0.1.0'
      }
    }
  };
  const rateLimitPayload = { method: 'account/rateLimits/read', id: rateLimitRequestId };
  return { initRequestId, rateLimitRequestId, initPayload, rateLimitPayload };
}

function sendJsonLine(child, payload, onError) {
  try {
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  } catch (error) {
    onError(error);
  }
}

function buildRateLimitEnv(codexHome) {
  const env = { ...process.env, CODEX_HOME: codexHome };
  env.HOME = path.dirname(codexHome);
  const existingMounts = env.CODEX_MOUNT_PATHS || '';
  const mountParts = existingMounts.split(':').filter(Boolean);
  if (fs.existsSync(codexHome) && !mountParts.includes(codexHome)) {
    mountParts.push(codexHome);
  }
  if (mountParts.length > 0) {
    env.CODEX_MOUNT_PATHS = mountParts.join(':');
  }
  return env;
}

function readRateLimits(child, payloads) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let buffer = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      finalize(new Error('Timed out reading usage limits from Codex.'));
    }, 15000);

    const finalize = (error, value) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeout);
      try {
        child.kill('SIGTERM');
      } catch (killError) {
        // Ignore kill errors.
      }
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    const handleMessage = (message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      if (message.id === payloads.initRequestId) {
        if (message.error) {
          const messageText = message.error.message || 'Failed to initialize Codex app-server.';
          finalize(new Error(messageText));
          return;
        }
        sendJsonLine(child, { method: 'initialized' }, finalize);
        sendJsonLine(child, payloads.rateLimitPayload, finalize);
        return;
      }
      if (message.id === payloads.rateLimitRequestId) {
        if (message.error) {
          const messageText = message.error.message || 'Failed to read account rate limits.';
          finalize(new Error(messageText));
          return;
        }
        finalize(null, message.result?.rateLimits ?? null);
      }
    };

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const message = JSON.parse(line);
            handleMessage(message);
          } catch (error) {
            // Ignore parse errors from non-JSON output.
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => finalize(error));
    child.on('close', () => {
      if (resolved) {
        return;
      }
      const message = stderr.trim() || 'Codex app-server exited before responding.';
      finalize(new Error(message));
    });

    sendJsonLine(child, payloads.initPayload, finalize);
  });
}

async function readAccountRateLimits({ spawn, codexHome }) {
  const child = spawn('codex-docker', ['app-server'], {
    env: buildRateLimitEnv(codexHome),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return readRateLimits(child, createRateLimitPayloads());
}

module.exports = {
  buildRateLimitEnv,
  readAccountRateLimits
};
