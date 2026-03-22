const fs = require('node:fs');
const path = require('node:path');
const { AccountStore } = require('../accounts');
const {
  DEFAULT_GIT_CREDENTIAL_HELPER,
  DEFAULT_ACCOUNT_ROTATION_LIMIT,
  DEFAULT_GIT_CONFIG_CONTAINER_PATH
} = require('./constants');
const { pathExists } = require('../storage');
const { resolveConfig } = require('./config');

class Orchestrator {
  constructor(options = {}) {
    const config = resolveConfig(options);
    this.dataRoot = options.dataRoot || process.env.ORCH_DATA_DIR || options.orchHome || config.dataRoot;
    this.dataVolumeName = config.dataVolumeName;
    this.orchHome = config.orchHome;
    this.codexHome = config.codexHome;
    this.gitConfigGlobalPath =
      options.gitConfigGlobalPath ||
      process.env.GIT_CONFIG_GLOBAL ||
      path.join(this.dataRoot, 'git', '.gitconfig');
    const baseExec = config.exec;
    const baseSpawn = config.spawn;
    this.exec = (command, args, execOptions = {}) => {
      const env = this.withRuntimeEnv(execOptions.env);
      if (command === 'git') {
        const gitArgs = this.withGitCredentialHelper(args);
        return baseExec(command, gitArgs, { ...execOptions, env });
      }
      return baseExec(command, args, { ...execOptions, env });
    };
    this.spawn = (command, args, spawnOptions = {}) =>
      baseSpawn(command, args, {
        ...spawnOptions,
        env: this.withRuntimeEnv(spawnOptions.env)
      });
    this.now = config.now;
    this.fetch = config.fetch;
    this.imageName = config.imageName;
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

  withRuntimeEnv(baseEnv = null) {
    const env = { ...(baseEnv || process.env) };
    if (!env.ORCH_DATA_DIR) {
      env.ORCH_DATA_DIR = this.dataRoot;
    }
    if (!env.GIT_CONFIG_GLOBAL) {
      env.GIT_CONFIG_GLOBAL = this.gitConfigGlobalPath;
    }
    const gitToken = this.readGitToken();
    if (gitToken) {
      env.GH_TOKEN = gitToken;
    } else {
      delete env.GH_TOKEN;
    }
    return env;
  }

  readGitToken() {
    try {
      if (!fs.existsSync(this.gitTokenPath())) {
        return '';
      }
      return fs.readFileSync(this.gitTokenPath(), 'utf8').trim();
    } catch {
      return '';
    }
  }

  gitTokenPath() {
    return path.join(this.orchHome, 'git', 'github-token');
  }

  gitConfigContainerPath() {
    return DEFAULT_GIT_CONFIG_CONTAINER_PATH;
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
