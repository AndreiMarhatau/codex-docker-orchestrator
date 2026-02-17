const { ensureDir, pathExists, removePath } = require('../../storage');

const TASK_DOCKER_TARGET_SOCKET_PATH = '/var/run/docker.sock';
const TASK_DOCKER_SIDECAR_MOUNT_SOCKET_DIR = '/var/run/orch-task-docker';
const TASK_DOCKER_SIDECAR_SOCKET_FILE = 'docker.sock';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseBooleanFlag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

async function execIgnoreNotFound(orchestrator, args) {
  const result = await orchestrator.exec('docker', args);
  if (result.code === 0) {
    return;
  }
  const output = `${result.stderr || ''}\n${result.stdout || ''}`.toLowerCase();
  if (output.includes('no such container') || output.includes('not found')) {
    return;
  }
  throw new Error((result.stderr || result.stdout || 'docker command failed').trim());
}

function taskSidecarName(orchestrator, taskId) {
  return `${orchestrator.taskDockerSidecarNamePrefix}-${taskId}`;
}

function taskSidecarVolumeName(orchestrator, taskId) {
  return `${orchestrator.taskDockerSidecarNamePrefix}-${taskId}-data`;
}

async function execTaskDocker(orchestrator, args, execOptions = {}) {
  const controller = new AbortController();
  const parentSignal = execOptions.signal;
  const timeoutMs = orchestrator.taskDockerCommandTimeoutMs;
  let timeoutHandle = null;
  let onParentAbort = null;

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      onParentAbort = () => controller.abort();
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }
  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    return await orchestrator.exec('docker', args, { ...execOptions, signal: controller.signal });
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

async function execTaskDockerOrThrow(orchestrator, args, execOptions = {}) {
  const result = await execTaskDocker(orchestrator, args, execOptions);
  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout || 'docker command failed').trim());
  }
  return result;
}

async function waitForTaskDockerReady(orchestrator, taskId, execOptions = {}) {
  const socketPath = orchestrator.taskDockerSocketPath(taskId);
  const timeoutMs = orchestrator.taskDockerReadyTimeoutMs;
  const timeoutAt = timeoutMs > 0 ? Date.now() + timeoutMs : Number.POSITIVE_INFINITY;
  let lastError = null;
  while (Date.now() < timeoutAt) {
    try {
      const infoResult = await execTaskDocker(orchestrator, [
        '--host',
        `unix://${socketPath}`,
        'info'
      ], execOptions);
      if (infoResult.code === 0) {
        return socketPath;
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (error?.code !== 'DOCKER_COMMAND_TIMEOUT') {
        throw error;
      }
      lastError = error;
    }
    await delay(orchestrator.taskDockerReadyIntervalMs);
  }
  const suffix = lastError?.message ? ` Last error: ${lastError.message}` : '';
  throw new Error(
    `Task Docker sidecar for ${taskId} did not become ready within ${orchestrator.taskDockerReadyTimeoutMs}ms.${suffix}`
  );
}

function attachTaskDockerSidecarMethods(Orchestrator) {
  Orchestrator.prototype.taskDockerTargetSocketPath = function taskDockerTargetSocketPath() {
    return TASK_DOCKER_TARGET_SOCKET_PATH;
  };

  Orchestrator.prototype.taskDockerSocketMount = function taskDockerSocketMount(taskId) {
    return {
      source: this.taskDockerSocketPath(taskId),
      target: TASK_DOCKER_TARGET_SOCKET_PATH
    };
  };

  Orchestrator.prototype.taskDockerSidecarExists = async function taskDockerSidecarExists(taskId, execOptions = {}) {
    const sidecarName = taskSidecarName(this, taskId);
    const inspectResult = await execTaskDocker(this, ['container', 'inspect', sidecarName], execOptions);
    return inspectResult.code === 0;
  };

  Orchestrator.prototype.ensureTaskDockerSidecar = async function ensureTaskDockerSidecar(taskId, execOptions = {}) {
    const sidecarName = taskSidecarName(this, taskId);
    const volumeName = taskSidecarVolumeName(this, taskId);
    const socketDir = this.taskDockerSocketDir(taskId);
    const socketPath = this.taskDockerSocketPath(taskId);

    await ensureDir(socketDir);
    await execTaskDockerOrThrow(this, ['volume', 'create', volumeName], execOptions);
    const inspectResult = await execTaskDocker(this, [
      'container',
      'inspect',
      '--format',
      '{{.State.Running}}',
      sidecarName
    ], execOptions);
    const isRunning = inspectResult.code === 0 && parseBooleanFlag(inspectResult.stdout);
    if (!isRunning && (await pathExists(socketPath))) {
      await removePath(socketPath);
    }
    if (inspectResult.code !== 0) {
      await execTaskDockerOrThrow(this, [
        'run',
        '-d',
        '--name',
        sidecarName,
        '--privileged',
        '--restart',
        'no',
        '-e',
        'DOCKER_TLS_CERTDIR=',
        '-v',
        `${volumeName}:/var/lib/docker`,
        '-v',
        `${socketDir}:${TASK_DOCKER_SIDECAR_MOUNT_SOCKET_DIR}`,
        this.taskDockerSidecarImage,
        'dockerd',
        '--host',
        `unix://${TASK_DOCKER_SIDECAR_MOUNT_SOCKET_DIR}/${TASK_DOCKER_SIDECAR_SOCKET_FILE}`
      ], execOptions);
    } else if (!isRunning) {
      await execTaskDockerOrThrow(this, ['start', sidecarName], execOptions);
    }

    await waitForTaskDockerReady(this, taskId, execOptions);
    return socketPath;
  };

  Orchestrator.prototype.stopTaskDockerSidecar = async function stopTaskDockerSidecar(taskId) {
    const sidecarName = taskSidecarName(this, taskId);
    await execIgnoreNotFound(this, ['stop', sidecarName]);
  };

  Orchestrator.prototype.removeTaskDockerSidecar = async function removeTaskDockerSidecar(taskId) {
    const sidecarName = taskSidecarName(this, taskId);
    const volumeName = taskSidecarVolumeName(this, taskId);
    await execIgnoreNotFound(this, ['rm', '-f', sidecarName]);
    await this.exec('docker', ['volume', 'rm', '-f', volumeName]);
    await removePath(this.taskDockerDir(taskId));
  };
}

module.exports = {
  attachTaskDockerSidecarMethods
};
