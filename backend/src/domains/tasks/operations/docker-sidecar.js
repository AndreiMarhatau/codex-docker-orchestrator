const { ensureDir, pathExists, removePath } = require('../../../shared/filesystem/storage');
const { createDockerCommandRunner } = require('../../../shared/docker/commands');
const {
  DOCKER_SIDECAR_MOUNT_SOCKET_DIR,
  DOCKER_TARGET_SOCKET_PATH,
  ensureDockerSidecar
} = require('../../../shared/docker/sidecar');

function taskSidecarName(orchestrator, taskId) { return `${orchestrator.taskDockerSidecarNamePrefix}-${taskId}`; }
function taskSidecarVolumeName(orchestrator, taskId) { return `${orchestrator.taskDockerSidecarNamePrefix}-${taskId}-data`; }

function createTaskDockerRunner(orchestrator) {
  return createDockerCommandRunner({
    exec: (args, options) => orchestrator.exec('docker', args, options),
    timeoutMs: orchestrator.taskDockerCommandTimeoutMs
  });
}

function attachTaskDockerSidecarMethods(Orchestrator) {
  Orchestrator.prototype.taskDockerTargetSocketPath = function taskDockerTargetSocketPath() {
    return DOCKER_TARGET_SOCKET_PATH;
  };

  Orchestrator.prototype.taskDockerSocketMount = function taskDockerSocketMount(taskId) {
    return { source: this.taskDockerSocketPath(taskId), target: DOCKER_TARGET_SOCKET_PATH };
  };

  Orchestrator.prototype.taskDockerSidecarExists = async function taskDockerSidecarExists(taskId, execOptions = {}) {
    const inspectResult = await createTaskDockerRunner(this).run(
      ['container', 'inspect', taskSidecarName(this, taskId)],
      execOptions
    );
    return inspectResult.code === 0;
  };

  Orchestrator.prototype.ensureTaskDockerSidecar = async function ensureTaskDockerSidecar(taskId, execOptions = {}) {
    const sidecarName = taskSidecarName(this, taskId);
    const volumeName = taskSidecarVolumeName(this, taskId);
    const socketDir = this.taskDockerSocketDir(taskId);
    const socketPath = this.taskDockerSocketPath(taskId);

    const socketMount = `type=volume,src=${this.dataVolumeName},dst=${DOCKER_SIDECAR_MOUNT_SOCKET_DIR},volume-subpath=${this.volumeSubpathFor(socketDir)}`;
    return ensureDockerSidecar({
      description: `Task Docker sidecar for ${taskId}`,
      image: this.taskDockerSidecarImage,
      readyIntervalMs: this.taskDockerReadyIntervalMs,
      readyTimeoutMs: this.taskDockerReadyTimeoutMs,
      runner: createTaskDockerRunner(this),
      sidecarName,
      socketDir,
      socketMount,
      socketPath,
      storage: { ensureDir, pathExists, removePath },
      volumeName
    }, execOptions);
  };

  Orchestrator.prototype.stopTaskDockerSidecar = async function stopTaskDockerSidecar(taskId) {
    await createTaskDockerRunner(this).ignoreNotFound(['stop', taskSidecarName(this, taskId)]);
  };

  Orchestrator.prototype.removeTaskDockerSidecar = async function removeTaskDockerSidecar(taskId) {
    const runner = createTaskDockerRunner(this);
    const volumeName = taskSidecarVolumeName(this, taskId);
    await runner.ignoreNotFound(['rm', '-f', taskSidecarName(this, taskId)]);
    await runner.runOrThrow(['volume', 'rm', '-f', volumeName]);
    await removePath(this.taskDockerDir(taskId));
  };
}

module.exports = { attachTaskDockerSidecarMethods };
