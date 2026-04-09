const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizeRateLimits, readString } = require('./account-rate-limits-normalizer');
const WHAM_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';

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

function shouldFallbackToWhamUsage(error) {
  const message = readString(error?.message);
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  const contractIndicators = [
    'decod',
    'deserial',
    'schema',
    'unknown variant',
    'unknown field',
    'missing field',
    'invalid type',
    'unexpected type',
    'unexpected value',
    'parse error',
    'failed to parse'
  ];
  if (!contractIndicators.some((indicator) => lower.includes(indicator))) {
    return false;
  }
  const unrelatedIndicators = [
    'timed out',
    'timeout',
    'unauthorized',
    'forbidden',
    'permission denied',
    'network',
    'econn',
    'enotfound',
    'socket hang up',
    'tls',
    'certificate',
    'service unavailable'
  ];
  return !unrelatedIndicators.some((indicator) => lower.includes(indicator));
}

async function readAuthJson(codexHomePath) {
  if (!readString(codexHomePath)) {
    throw new Error('Unable to locate Codex auth.json for direct rate-limit fetch.');
  }
  const authPath = path.join(codexHomePath, 'auth.json');
  const raw = await fs.readFile(authPath, 'utf8');
  return JSON.parse(raw);
}

function readAccessToken(auth) {
  return readString(auth?.tokens?.access_token, auth?.access_token);
}

async function fetchWhamUsageRateLimits({ fetchImpl, codexHomePath }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is not available for direct rate-limit fallback.');
  }
  const auth = await readAuthJson(codexHomePath);
  const accessToken = readAccessToken(auth);
  if (!accessToken) {
    throw new Error('Active account auth.json does not include an access token for rate-limit fallback.');
  }
  const response = await fetchImpl(WHAM_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message =
      readString(payload?.detail, payload?.message, payload?.error?.message) ||
      `Direct rate-limit fetch failed with status ${response.status}.`;
    throw new Error(message);
  }
  return normalizeRateLimits(payload);
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

async function readAccountRateLimits({ spawn, env, fetchImpl = global.fetch, codexHomePath }) {
  try {
    const child = spawn('codex-docker', ['app-server'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const rateLimits = await readRateLimits(child, createRateLimitPayloads());
    return normalizeRateLimits(rateLimits);
  } catch (error) {
    if (!shouldFallbackToWhamUsage(error)) {
      throw error;
    }
    return fetchWhamUsageRateLimits({ fetchImpl, codexHomePath });
  }
}

module.exports = { readAccountRateLimits };
