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

async function waitForTaskDockerReady(orchestrator, taskId) {
  const socketPath = orchestrator.taskDockerSocketPath(taskId);
  const timeoutMs = orchestrator.taskDockerReadyTimeoutMs;
  const timeoutAt = timeoutMs > 0 ? Date.now() + timeoutMs : Number.POSITIVE_INFINITY;
  while (Date.now() < timeoutAt) {
    const infoResult = await orchestrator.exec('docker', [
      '--host',
      `unix://${socketPath}`,
      'info'
    ]);
    if (infoResult.code === 0) {
      return socketPath;
    }
    await delay(orchestrator.taskDockerReadyIntervalMs);
  }
  throw new Error(
    `Task Docker sidecar for ${taskId} did not become ready within ${orchestrator.taskDockerReadyTimeoutMs}ms.`
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

  Orchestrator.prototype.taskDockerSidecarExists = async function taskDockerSidecarExists(taskId) {
    const sidecarName = taskSidecarName(this, taskId);
    const inspectResult = await this.exec('docker', ['container', 'inspect', sidecarName]);
    return inspectResult.code === 0;
  };

  Orchestrator.prototype.ensureTaskDockerSidecar = async function ensureTaskDockerSidecar(taskId) {
    const sidecarName = taskSidecarName(this, taskId);
    const volumeName = taskSidecarVolumeName(this, taskId);
    const socketDir = this.taskDockerSocketDir(taskId);
    const socketPath = this.taskDockerSocketPath(taskId);

    await ensureDir(socketDir);
    await this.execOrThrow('docker', ['volume', 'create', volumeName]);
    const inspectResult = await this.exec('docker', [
      'container',
      'inspect',
      '--format',
      '{{.State.Running}}',
      sidecarName
    ]);
    const isRunning = inspectResult.code === 0 && parseBooleanFlag(inspectResult.stdout);
    if (!isRunning && (await pathExists(socketPath))) {
      await removePath(socketPath);
    }
    if (inspectResult.code !== 0) {
      await this.execOrThrow('docker', [
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
      ]);
    } else if (!isRunning) {
      await this.execOrThrow('docker', ['start', sidecarName]);
    }

    await waitForTaskDockerReady(this, taskId);
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
