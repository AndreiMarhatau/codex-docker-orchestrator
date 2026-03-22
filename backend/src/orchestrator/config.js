const path = require('node:path');
const os = require('node:os');
const { runCommand } = require('../commands');
const { spawn } = require('node:child_process');
const {
  DEFAULT_DATA_ROOT,
  DEFAULT_ORCH_HOME,
  DEFAULT_CODEX_HOME,
  DEFAULT_GIT_CONFIG_GLOBAL,
  DEFAULT_IMAGE_NAME,
  DEFAULT_TASK_DOCKER_SIDECAR_IMAGE,
  DEFAULT_TASK_DOCKER_SIDECAR_NAME_PREFIX,
  DEFAULT_TASK_DOCKER_READY_TIMEOUT_MS,
  DEFAULT_TASK_DOCKER_READY_INTERVAL_MS,
  DEFAULT_TASK_DOCKER_COMMAND_TIMEOUT_MS
} = require('./constants');

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

function resolveConfig(options) {
  return {
    dataRoot: resolveOptional(options, 'dataRoot', 'ORCH_DATA_DIR', DEFAULT_DATA_ROOT),
    dataVolumeName: resolveOptional(
      options,
      'dataVolumeName',
      'ORCH_DATA_VOLUME',
      'codex-orchestrator-data'
    ),
    orchHome: resolveOptional(options, 'orchHome', 'ORCH_HOME', DEFAULT_ORCH_HOME),
    codexHome: resolveOptional(options, 'codexHome', 'CODEX_HOME', DEFAULT_CODEX_HOME),
    gitConfigGlobalPath: resolveOptional(
      options,
      'gitConfigGlobalPath',
      'GIT_CONFIG_GLOBAL',
      DEFAULT_GIT_CONFIG_GLOBAL
    ),
    exec: options.exec || runCommand,
    spawn: options.spawn || spawn,
    now: options.now || (() => new Date().toISOString()),
    fetch: options.fetch || global.fetch,
    imageName: resolveOptional(options, 'imageName', 'IMAGE_NAME', DEFAULT_IMAGE_NAME),
    getUid: options.getUid || (() => (typeof process.getuid === 'function' ? process.getuid() : null)),
    getGid: options.getGid || (() => (typeof process.getgid === 'function' ? process.getgid() : null)),
    accountStore: options.accountStore,
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
