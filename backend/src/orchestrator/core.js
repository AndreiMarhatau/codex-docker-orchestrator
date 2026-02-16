const fs = require('node:fs');
const { AccountStore } = require('../accounts');
const {
  DEFAULT_GIT_CREDENTIAL_HELPER,
  DEFAULT_ACCOUNT_ROTATION_LIMIT
} = require('./constants');
const { pathExists } = require('../storage');
const { resolveConfig } = require('./config');

class Orchestrator {
  constructor(options = {}) {
    const config = resolveConfig(options);
    this.orchHome = config.orchHome;
    this.codexHome = config.codexHome;
    const baseExec = config.exec;
    this.exec = (command, args, execOptions = {}) => {
      if (command === 'git') {
        const gitArgs = this.withGitCredentialHelper(args);
        return baseExec(command, gitArgs, execOptions);
      }
      return baseExec(command, args, execOptions);
    };
    this.spawn = config.spawn;
    this.now = config.now;
    this.fetch = config.fetch;
    this.imageName = config.imageName;
    this.orchAgentsFile = config.orchAgentsFile;
    this.hostDockerAgentsFile = config.hostDockerAgentsFile;
    this.contextReposTemplateFile = config.contextReposTemplateFile;
    this.attachmentsTemplateFile = config.attachmentsTemplateFile;
    this.getUid = config.getUid;
    this.getGid = config.getGid;
    this.taskDockerSidecarImage = config.taskDockerSidecarImage;
    this.taskDockerSidecarNamePrefix = config.taskDockerSidecarNamePrefix;
    this.taskDockerReadyTimeoutMs = this.parseNonNegativeInt(
      config.taskDockerReadyTimeoutMs,
      600_000
    );
    this.taskDockerReadyIntervalMs = this.parsePositiveInt(
      config.taskDockerReadyIntervalMs,
      500
    );
    this.taskDockerCommandTimeoutMs = this.parseNonNegativeInt(
      config.taskDockerCommandTimeoutMs,
      600_000
    );
    this.running = new Map();
    this.accountStore =
      config.accountStore ||
      new AccountStore({
        orchHome: this.orchHome,
        codexHome: this.codexHome,
        now: this.now
      });
    this.maxAccountRotations = config.maxAccountRotations ?? this.parseRotationLimitEnv();
  }

  parseRotationLimitEnv() {
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

  parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return fallback;
    }
    return parsed;
  }

  parseNonNegativeInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }

  gitCredentialHelper() {
    const helper =
      process.env.ORCH_GIT_CREDENTIAL_HELPER ||
      process.env.GIT_CONFIG_VALUE_1 ||
      DEFAULT_GIT_CREDENTIAL_HELPER;
    return helper || null;
  }

  withGitCredentialHelper(args = []) {
    const helper = this.gitCredentialHelper();
    if (!helper) {
      return args;
    }
    return ['-c', 'credential.helper=', '-c', `credential.helper=${helper}`, ...args];
  }

  dockerSocketPath() {
    if (process.env.DOCKER_SOCK) {
      return process.env.DOCKER_SOCK;
    }
    const dockerHost = process.env.DOCKER_HOST || '';
    if (dockerHost.startsWith('unix://')) {
      return dockerHost.slice('unix://'.length);
    }
    return '/var/run/docker.sock';
  }

  requireDockerSocket() {
    const socketPath = this.dockerSocketPath();
    if (!socketPath) {
      throw new Error('Docker socket path is not configured.');
    }
    if (!fs.existsSync(socketPath)) {
      throw new Error(`Docker socket not found at ${socketPath}.`);
    }
    return socketPath;
  }

  async execOrThrow(command, args, options) {
    const result = await this.exec(command, args, options);
    if (result.code !== 0) {
      const message = result.stderr || result.stdout || `${command} failed`;
      throw new Error(message.trim());
    }
    return result;
  }

  async ensureOwnership(targetPath) {
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
      } catch (error) {
        // Best-effort: deletion can still proceed if chown fails.
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
    } catch (error) {
      // Best-effort: deletion can still proceed if chown fails.
    }
  }

  async ensureActiveAuth() {
    try {
      await this.accountStore.applyActiveAccount();
    } catch (error) {
      // Best-effort: codex may still use existing auth.json.
    }
  }
}

module.exports = {
  Orchestrator
};
