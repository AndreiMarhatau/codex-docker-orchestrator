const { EventEmitter } = require('node:events');

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function sendJsonLine(child, payload, onError) {
  try {
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  } catch (error) {
    onError(error);
  }
}

function createInitializePayload() {
  return {
    method: 'initialize',
    params: {
      clientInfo: {
        name: 'codex-docker-orchestrator',
        title: 'Codex Docker Orchestrator',
        version: '0.1.0'
      },
      capabilities: {
        experimentalApi: true,
        optOutNotificationMethods: ['item/agentMessage/delta']
      }
    }
  };
}

class AppServerClient extends EventEmitter {
  constructor({ child, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS }) {
    super();
    this.child = child;
    this.requestTimeoutMs = requestTimeoutMs;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.stdoutBuffer = '';
    this.stderr = '';
    this.closed = false;
    this.closeCode = null;
    this.closeSignal = null;
    this.bindChild();
  }

  bindChild() {
    this.child.stdout.on('data', (chunk) => {
      this.stdoutBuffer += chunk.toString();
      let newlineIndex = this.stdoutBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
        if (line) {
          this.handleLine(line);
        }
        newlineIndex = this.stdoutBuffer.indexOf('\n');
      }
    });

    this.child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      this.stderr += text;
      this.emit('stderr', text);
    });

    this.child.on('error', (error) => this.rejectAll(error));
    this.child.on('close', (code, signal) => {
      this.closed = true;
      this.closeCode = code;
      this.closeSignal = signal;
      this.rejectAll(
        new Error(this.stderr.trim() || 'Codex app-server exited before responding.')
      );
      this.emit('close', code, signal);
    });
  }

  handleLine(line) {
    let message = null;
    try {
      message = JSON.parse(line);
    } catch {
      this.emit('stdoutText', line);
      return;
    }

    if (message && Object.prototype.hasOwnProperty.call(message, 'id')) {
      if (message.method) {
        this.respondToServerRequest(message);
        return;
      }
      this.resolveRequest(message);
      return;
    }

    if (message?.method) {
      this.emit('notification', message);
    }
  }

  respondToServerRequest(message) {
    sendJsonLine(
      this.child,
      {
        id: message.id,
        error: {
          code: -32601,
          message: `Unsupported app-server request: ${message.method}`
        }
      },
      (error) => this.emit('error', error)
    );
  }

  resolveRequest(message) {
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) {
      pending.reject(new Error(message.error.message || 'Codex app-server request failed.'));
      return;
    }
    pending.resolve(message.result);
  }

  rejectAll(error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  request(method, params = undefined, options = {}) {
    if (this.closed) {
      return Promise.reject(
        new Error(this.stderr.trim() || 'Codex app-server is no longer running.')
      );
    }
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    const payload = { method, id };
    if (params !== undefined) {
      payload.params = params;
    }
    const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for Codex app-server method ${method}.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      sendJsonLine(this.child, payload, (error) => {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  notify(method, params = undefined) {
    const payload = { method };
    if (params !== undefined) {
      payload.params = params;
    }
    sendJsonLine(this.child, payload, (error) => this.emit('error', error));
  }

  async initialize() {
    await this.request('initialize', createInitializePayload().params);
    this.notify('initialized');
  }
}

module.exports = {
  AppServerClient
};
