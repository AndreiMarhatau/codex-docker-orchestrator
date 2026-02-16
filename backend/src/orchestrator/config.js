const path = require('node:path');
const os = require('node:os');
const { runCommand } = require('../commands');
const { spawn } = require('node:child_process');
const {
  DEFAULT_ORCH_HOME,
  DEFAULT_IMAGE_NAME,
  DEFAULT_ORCH_AGENTS_FILE,
  DEFAULT_HOST_DOCKER_AGENTS_FILE,
  DEFAULT_CONTEXT_REPOS_TEMPLATE_FILE,
  DEFAULT_ATTACHMENTS_TEMPLATE_FILE,
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
    orchHome: resolveOptional(options, 'orchHome', 'ORCH_HOME', DEFAULT_ORCH_HOME),
    codexHome: resolveOptional(
      options,
      'codexHome',
      'CODEX_HOME',
      path.join(os.homedir(), '.codex')
    ),
    exec: options.exec || runCommand,
    spawn: options.spawn || spawn,
    now: options.now || (() => new Date().toISOString()),
    fetch: options.fetch || global.fetch,
    imageName: resolveOptional(options, 'imageName', 'IMAGE_NAME', DEFAULT_IMAGE_NAME),
    orchAgentsFile: resolveOptional(
      options,
      'orchAgentsFile',
      'ORCH_AGENTS_FILE',
      DEFAULT_ORCH_AGENTS_FILE
    ),
    hostDockerAgentsFile: resolveOptional(
      options,
      'hostDockerAgentsFile',
      'ORCH_HOST_DOCKER_AGENTS_FILE',
      DEFAULT_HOST_DOCKER_AGENTS_FILE
    ),
    contextReposTemplateFile: resolveOptional(
      options,
      'contextReposTemplateFile',
      'ORCH_CONTEXT_REPOS_TEMPLATE_FILE',
      DEFAULT_CONTEXT_REPOS_TEMPLATE_FILE
    ),
    attachmentsTemplateFile: resolveOptional(
      options,
      'attachmentsTemplateFile',
      'ORCH_ATTACHMENTS_TEMPLATE_FILE',
      DEFAULT_ATTACHMENTS_TEMPLATE_FILE
    ),
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
