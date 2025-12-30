const fs = require('node:fs');

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

function attachAccountMethods(Orchestrator) {
  Orchestrator.prototype.listAccounts = async function listAccounts() {
    return this.accountStore.listAccounts();
  };

  Orchestrator.prototype.addAccount = async function addAccount({ label, authJson }) {
    const account = await this.accountStore.addAccount({ label, authJson });
    await this.accountStore.applyActiveAccount();
    return account;
  };

  Orchestrator.prototype.activateAccount = async function activateAccount(accountId) {
    await this.accountStore.setActiveAccount(accountId);
    return this.listAccounts();
  };

  Orchestrator.prototype.rotateAccount = async function rotateAccount() {
    await this.accountStore.rotateActiveAccount();
    return this.listAccounts();
  };

  Orchestrator.prototype.removeAccount = async function removeAccount(accountId) {
    await this.accountStore.removeAccount(accountId);
    return this.listAccounts();
  };

  Orchestrator.prototype.getAccountRateLimits = async function getAccountRateLimits() {
    const activeAccount = await this.accountStore.getActiveAccount();
    if (!activeAccount?.id) {
      const { noActiveAccountError } = require('./errors');
      throw noActiveAccountError('No active account. Add or activate an account first.');
    }
    await this.ensureActiveAuth();
    const rateLimits = await this.fetchAccountRateLimits();
    return {
      account: activeAccount,
      rateLimits,
      fetchedAt: this.now()
    };
  };

  Orchestrator.prototype.fetchAccountRateLimits = async function fetchAccountRateLimits() {
    return this.fetchAccountRateLimitsForHome(this.codexHome);
  };

  Orchestrator.prototype.fetchAccountRateLimitsForHome = async function fetchAccountRateLimitsForHome(
    codexHome
  ) {
    const env = buildRateLimitEnv(codexHome);
    const child = this.spawn('codex-docker', ['app-server'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const payloads = createRateLimitPayloads();
    return readRateLimits(child, payloads);
  };
}

module.exports = {
  attachAccountMethods
};
