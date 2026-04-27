const {
  isAbortError,
  isPermissionDeniedOutput,
  parseBooleanFlag
} = require('./commands');

const DOCKER_TARGET_SOCKET_PATH = '/var/run/docker.sock';
const DOCKER_SIDECAR_MOUNT_SOCKET_DIR = '/var/run/orch-task-docker';
const DOCKER_SIDECAR_SOCKET_FILE = 'docker.sock';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSidecarDockerHost(mountSocketDir, socketFile) {
  return `unix://${mountSocketDir}/${socketFile}`;
}

async function waitForDockerReady({
  runner,
  socketPath,
  sidecarName,
  readyTimeoutMs,
  readyIntervalMs,
  description,
  execOptions = {},
  mountSocketDir = DOCKER_SIDECAR_MOUNT_SOCKET_DIR,
  socketFile = DOCKER_SIDECAR_SOCKET_FILE
}) {
  const timeoutAt = readyTimeoutMs > 0 ? Date.now() + readyTimeoutMs : Number.POSITIVE_INFINITY;
  let lastError = null;
  while (Date.now() < timeoutAt) {
    try {
      const infoResult = await runner.run(['--host', `unix://${socketPath}`, 'info'], execOptions);
      if (infoResult.code === 0) {
        return socketPath;
      }
      const output = `${infoResult.stderr || ''}\n${infoResult.stdout || ''}`.trim();
      if (isPermissionDeniedOutput(output)) {
        const host = buildSidecarDockerHost(mountSocketDir, socketFile);
        const inSidecar = await runner.run(['exec', sidecarName, 'docker', '--host', host, 'info'], execOptions);
        if (inSidecar.code === 0) {
          return socketPath;
        }
      }
      if (output) {
        lastError = new Error(output);
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
    await delay(readyIntervalMs);
  }
  const suffix = lastError?.message ? ` Last error: ${lastError.message}` : '';
  throw new Error(`${description} did not become ready within ${readyTimeoutMs}ms.${suffix}`);
}

async function ensureDockerSidecar(options, execOptions = {}) {
  const {
    image,
    mountSocketDir = DOCKER_SIDECAR_MOUNT_SOCKET_DIR,
    runner,
    sidecarName,
    socketDir,
    socketFile = DOCKER_SIDECAR_SOCKET_FILE,
    socketMount,
    socketPath,
    storage,
    volumeName
  } = options;
  await storage.ensureDir(socketDir);
  await runner.runOrThrow(['volume', 'create', volumeName], execOptions);
  const inspect = await runner.run(
    ['container', 'inspect', '--format', '{{.State.Running}}', sidecarName],
    execOptions
  );
  const isRunning = inspect.code === 0 && parseBooleanFlag(inspect.stdout);
  if (!isRunning && (await storage.pathExists(socketPath))) {
    await storage.removePath(socketPath);
  }
  if (inspect.code !== 0) {
    const host = buildSidecarDockerHost(mountSocketDir, socketFile);
    await runner.runOrThrow([
      'run', '-d', '--name', sidecarName, '--privileged', '--restart', 'no',
      '-e', 'DOCKER_TLS_CERTDIR=', '-v', `${volumeName}:/var/lib/docker`,
      '--mount', socketMount, image, 'dockerd', '--host', host
    ], execOptions);
  } else if (!isRunning) {
    await runner.runOrThrow(['start', sidecarName], execOptions);
  }
  return waitForDockerReady({ ...options, execOptions });
}

module.exports = {
  DOCKER_SIDECAR_MOUNT_SOCKET_DIR,
  DOCKER_SIDECAR_SOCKET_FILE,
  DOCKER_TARGET_SOCKET_PATH,
  ensureDockerSidecar,
  waitForDockerReady
};
