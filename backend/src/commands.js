const { spawn } = require('node:child_process');

function createAbortError() {
  const error = new Error('Command aborted');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let abortHandler = null;

    const cleanup = () => {
      if (options.signal && abortHandler) {
        options.signal.removeEventListener('abort', abortHandler);
      }
    };

    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    abortHandler = () => {
      try {
        child.kill('SIGTERM');
      } catch (error) {
        // Ignore kill errors.
      }
      finish(() => reject(createAbortError()));
    };
    if (options.signal) {
      options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    child.on('error', (error) => {
      finish(() => reject(error));
    });
    child.on('close', (code) => {
      if (options.signal?.aborted) {
        finish(() => reject(createAbortError()));
        return;
      }
      finish(() => resolve({ stdout, stderr, code }));
    });
  });
}

module.exports = {
  runCommand
};
