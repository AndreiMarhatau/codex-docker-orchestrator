const path = require('node:path');
const { runCommand } = require('../commands');
const { spawn } = require('node:child_process');
const {
  DEFAULT_DATA_ROOT,
  DEFAULT_ORCH_HOME,
  DEFAULT_CODEX_HOME,
  DEFAULT_IMAGE_NAME,
  DEFAULT_TASK_DOCKER_SIDECAR_IMAGE,
  DEFAULT_TASK_DOCKER_SIDECAR_NAME_PREFIX,
  DEFAULT_TASK_DOCKER_READY_TIMEOUT_MS,
  DEFAULT_TASK_DOCKER_READY_INTERVAL_MS,
  DEFAULT_TASK_DOCKER_COMMAND_TIMEOUT_MS
} = require('./constants');
const { DEFAULT_MANAGED_AGENTS } = require('./managed-agents');

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function resolveOptional(options, key, envKey, defaultValue) {
  if (Object.prototype.hasOwnProperty.call(options, key) && isPresent(options[key])) {
    return options[key];
  }
  if (envKey && Object.prototype.hasOwnProperty.call(process.env, envKey)) {
    const envValue = process.env[envKey];
    if (isPresent(envValue)) {
      return envValue;
    }
  }
  return defaultValue;
}

function isPathInside(parentPath, targetPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveDataRoot(options) {
  if (Object.prototype.hasOwnProperty.call(options, 'dataRoot') && isPresent(options.dataRoot)) {
    return options.dataRoot;
  }
  if (Object.prototype.hasOwnProperty.call(options, 'orchHome') && isPresent(options.orchHome)) {
    return options.orchHome;
  }
  return resolveOptional({}, 'dataRoot', 'ORCH_DATA_DIR', DEFAULT_DATA_ROOT);
}

function resolveConfig(options) {
  const dataRoot = resolveDataRoot(options);
  const explicitGitConfigGlobalPath =
    Object.prototype.hasOwnProperty.call(options, 'gitConfigGlobalPath') && isPresent(options.gitConfigGlobalPath)
      ? options.gitConfigGlobalPath
      : null;
  const envGitConfigGlobalPath =
    Object.prototype.hasOwnProperty.call(process.env, 'GIT_CONFIG_GLOBAL') && isPresent(process.env.GIT_CONFIG_GLOBAL)
      ? process.env.GIT_CONFIG_GLOBAL
      : null;
  const defaultGitConfigGlobalPath = path.join(dataRoot, 'git', '.gitconfig');
  const gitConfigGlobalPath = explicitGitConfigGlobalPath
    || (envGitConfigGlobalPath && isPathInside(dataRoot, envGitConfigGlobalPath)
      ? envGitConfigGlobalPath
      : defaultGitConfigGlobalPath);
  return {
    dataRoot,
    dataVolumeName: resolveOptional(
      options,
      'dataVolumeName',
      'ORCH_DATA_VOLUME',
      'codex-orchestrator-data'
    ),
    orchHome: resolveOptional(options, 'orchHome', 'ORCH_HOME', DEFAULT_ORCH_HOME),
    codexHome: resolveOptional(options, 'codexHome', 'CODEX_HOME', DEFAULT_CODEX_HOME),
    gitConfigGlobalPath,
    exec: options.exec || runCommand,
    spawn: options.spawn || spawn,
    now: options.now || (() => new Date().toISOString()),
    fetch: options.fetch || global.fetch,
    imageName: resolveOptional(options, 'imageName', 'IMAGE_NAME', DEFAULT_IMAGE_NAME),
    getUid: options.getUid || (() => (typeof process.getuid === 'function' ? process.getuid() : null)),
    getGid: options.getGid || (() => (typeof process.getgid === 'function' ? process.getgid() : null)),
    accountStore: options.accountStore,
    managedAgents: options.managedAgents || DEFAULT_MANAGED_AGENTS,
    maxAccountRotations: options.maxAccountRotations,
    taskDockerSidecarImage: resolveOptional(
      options,
      'taskDockerSidecarImage',
      'ORCH_TASK_DOCKER_SIDECAR_IMAGE',
      DEFAULT_TASK_DOCKER_SIDECAR_IMAGE
    ),
    taskDockerSidecarNamePrefix: resolveOptional(
      options,
      'taskDockerSidecarNamePrefix',
      'ORCH_TASK_DOCKER_SIDECAR_NAME_PREFIX',
      DEFAULT_TASK_DOCKER_SIDECAR_NAME_PREFIX
    ),
    taskDockerReadyTimeoutMs: Number.parseInt(
      resolveOptional(
        options,
        'taskDockerReadyTimeoutMs',
        'ORCH_TASK_DOCKER_READY_TIMEOUT_MS',
        DEFAULT_TASK_DOCKER_READY_TIMEOUT_MS
      ),
      10
    ),
    taskDockerReadyIntervalMs: Number.parseInt(
      resolveOptional(
        options,
        'taskDockerReadyIntervalMs',
        'ORCH_TASK_DOCKER_READY_INTERVAL_MS',
        DEFAULT_TASK_DOCKER_READY_INTERVAL_MS
      ),
      10
    ),
    taskDockerCommandTimeoutMs: Number.parseInt(
      resolveOptional(
        options,
        'taskDockerCommandTimeoutMs',
        'ORCH_TASK_DOCKER_COMMAND_TIMEOUT_MS',
        DEFAULT_TASK_DOCKER_COMMAND_TIMEOUT_MS
      ),
      10
    )
  };
}

module.exports = {
  resolveConfig
};
