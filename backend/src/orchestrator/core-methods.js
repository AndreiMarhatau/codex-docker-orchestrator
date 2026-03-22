const fs = require('node:fs');
const { pathExists } = require('../storage');
const {
  DEFAULT_ACCOUNT_ROTATION_LIMIT,
  DEFAULT_GIT_CREDENTIAL_HELPER
} = require('./constants');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseRotationLimitEnv() {
  const value = process.env.ORCH_ACCOUNT_ROTATION_MAX || DEFAULT_ACCOUNT_ROTATION_LIMIT;
  if (value === 'auto') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function gitCredentialHelper() {
  const helper =
    process.env.ORCH_GIT_CREDENTIAL_HELPER ||
    process.env.GIT_CONFIG_VALUE_1 ||
    DEFAULT_GIT_CREDENTIAL_HELPER;
  return helper || null;
}

function withGitCredentialHelper(args = []) {
  const helper = gitCredentialHelper();
  if (!helper) {
    return args;
  }
  return ['-c', 'credential.helper=', '-c', `credential.helper=${helper}`, ...args];
}

function dockerSocketPath() {
  if (process.env.DOCKER_SOCK) {
    return process.env.DOCKER_SOCK;
  }
  const dockerHost = process.env.DOCKER_HOST || '';
  if (dockerHost.startsWith('unix://')) {
    return dockerHost.slice('unix://'.length);
  }
  return '/var/run/docker.sock';
}

async function execOrThrow(command, args, options) {
  const result = await this.exec(command, args, options);
  if (result.code !== 0) {
    const message = result.stderr || result.stdout || `${command} failed`;
    throw new Error(message.trim());
  }
  return result;
}

async function ensureOwnership(targetPath) {
  if (!(await pathExists(targetPath))) {
    return;
  }
  const uid = this.getUid();
  const gid = this.getGid();
  if (uid === null || gid === null) {
    return;
  }
  const ownership = `${uid}:${gid}`;
  if (uid === 0) {
    try {
      await this.exec('chown', ['-R', ownership, targetPath]);
    } catch {
      return;
    }
    return;
  }
  const containerTarget = '/target';
  try {
    await this.exec('docker', [
      'run',
      '--rm',
      '-v',
      `${targetPath}:${containerTarget}`,
      '--entrypoint',
      '/bin/sh',
      this.imageName,
      '-c',
      `chown -R ${ownership} ${containerTarget}`
    ]);
  } catch {
    return;
  }
}

async function ensureActiveAuth() {
  try {
    await this.accountStore.applyActiveAccount();
  } catch {
    return;
  }
}

function attachCoreMethods(Orchestrator) {
  Orchestrator.prototype.parsePositiveInt = function boundParsePositiveInt(value, fallback) {
    return parsePositiveInt(value, fallback);
  };
  Orchestrator.prototype.parseNonNegativeInt = function boundParseNonNegativeInt(value, fallback) {
    return parseNonNegativeInt(value, fallback);
  };
  Orchestrator.prototype.parseRotationLimitEnv = function boundParseRotationLimitEnv() {
    return parseRotationLimitEnv();
  };
  Orchestrator.prototype.gitCredentialHelper = function boundGitCredentialHelper() {
    return gitCredentialHelper();
  };
  Orchestrator.prototype.withGitCredentialHelper = function boundWithGitCredentialHelper(args = []) {
    return withGitCredentialHelper(args);
  };
  Orchestrator.prototype.dockerSocketPath = function boundDockerSocketPath() {
    return dockerSocketPath();
  };
  Orchestrator.prototype.requireDockerSocket = function boundRequireDockerSocket() {
    const socketPath = this.dockerSocketPath();
    if (!socketPath) {
      throw new Error('Docker socket path is not configured.');
    }
    if (!fs.existsSync(socketPath)) {
      throw new Error(`Docker socket not found at ${socketPath}.`);
    }
    return socketPath;
  };
  Orchestrator.prototype.execOrThrow = execOrThrow;
  Orchestrator.prototype.ensureOwnership = ensureOwnership;
  Orchestrator.prototype.ensureActiveAuth = ensureActiveAuth;
}

module.exports = {
  attachCoreMethods
};
