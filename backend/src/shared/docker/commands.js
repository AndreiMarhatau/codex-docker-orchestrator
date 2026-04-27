function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function isNotFoundOutput(text) {
  const output = String(text || '').toLowerCase();
  return output.includes('no such container') || output.includes('not found');
}

function parseBooleanFlag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isPermissionDeniedOutput(text) {
  return String(text || '').toLowerCase().includes('permission denied');
}

function createDockerCommandRunner({ exec, timeoutMs }) {
  async function run(args, execOptions = {}) {
    const controller = new AbortController();
    const parentSignal = execOptions.signal;
    let timeoutHandle = null;
    let onParentAbort = null;
    if (parentSignal?.aborted) {
      controller.abort();
    } else if (parentSignal) {
      onParentAbort = () => controller.abort();
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      return await exec(args, { ...execOptions, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !parentSignal?.aborted && timeoutMs > 0) {
        const timeoutError = new Error(`Docker command timed out after ${timeoutMs}ms: docker ${args.join(' ')}`);
        timeoutError.code = 'DOCKER_COMMAND_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (onParentAbort) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    }
  }

  async function runOrThrow(args, execOptions = {}) {
    const result = await run(args, execOptions);
    if (result.code !== 0) {
      throw new Error((result.stderr || result.stdout || 'docker command failed').trim());
    }
    return result;
  }

  async function ignoreNotFound(args, execOptions = {}) {
    const result = await run(args, execOptions);
    if (result.code === 0 || isNotFoundOutput(`${result.stderr || ''}\n${result.stdout || ''}`)) {
      return;
    }
    throw new Error((result.stderr || result.stdout || 'docker command failed').trim());
  }

  return {
    ignoreNotFound,
    run,
    runOrThrow
  };
}

module.exports = {
  createDockerCommandRunner,
  isAbortError,
  isPermissionDeniedOutput,
  parseBooleanFlag
};
