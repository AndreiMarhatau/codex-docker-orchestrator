const fs = require('node:fs');
const path = require('node:path');
const { AccountStore } = require('../domains/accounts/store');
const { DEFAULT_GIT_CONFIG_CONTAINER_PATH } = require('../shared/config/constants');
const { resolveConfig } = require('./config');
const { attachCoreMethods } = require('./core-methods');

class Orchestrator {
  constructor(options = {}) {
    const config = resolveConfig(options);
    this.dataRoot = options.dataRoot || process.env.ORCH_DATA_DIR || options.orchHome || config.dataRoot;
    this.dataVolumeName = config.dataVolumeName;
    this.orchHome = config.orchHome;
    this.codexHome =
      options.codexHome ||
      process.env.CODEX_HOME ||
      (this.dataRoot !== config.dataRoot ? path.join(this.dataRoot, '.codex') : config.codexHome);
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
}

attachCoreMethods(Orchestrator);

module.exports = {
  Orchestrator
};
