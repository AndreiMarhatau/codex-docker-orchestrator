const fs = require('node:fs/promises');
const path = require('node:path');
const { ensureDir, pathExists, writeText, removePath } = require('../storage');
const {
  DEFAULT_GIT_CONFIG_CONTAINER_PATH,
  DEFAULT_GIT_CONFIG_CONTAINER_DIR,
  DEFAULT_INNER_CODEX_HOME
} = require('./constants');
const { setupRequiredError } = require('./errors');

const DEFAULT_GIT_USER_NAME = 'Codex Agent';
const DEFAULT_GIT_USER_EMAIL = 'codex@openai.com';

function buildGitConfig() {
  return [
    '[user]',
    `\tname = ${DEFAULT_GIT_USER_NAME}`,
    `\temail = ${DEFAULT_GIT_USER_EMAIL}`,
    '[credential]',
    '\thelper = !/usr/bin/gh auth git-credential',
    ''
  ].join('\n');
}

function mergePassthroughEnv(env, keys) {
  const existing = env.CODEX_PASSTHROUGH_ENV || '';
  const merged = new Set(existing.split(',').map((entry) => entry.trim()).filter(Boolean));
  for (const key of keys) {
    if (key) {
      merged.add(key);
    }
  }
  if (merged.size === 0) {
    delete env.CODEX_PASSTHROUGH_ENV;
    return;
  }
  env.CODEX_PASSTHROUGH_ENV = Array.from(merged).join(',');
}

function attachSetupMethods(Orchestrator) {
  Orchestrator.prototype.ensurePersistentConfig = async function ensurePersistentConfig() {
    await ensureDir(path.dirname(this.gitConfigGlobalPath));
    if (!(await pathExists(this.gitConfigGlobalPath))) {
      await writeText(this.gitConfigGlobalPath, buildGitConfig());
    }
    await ensureDir(this.codexHome);
  };

  Orchestrator.prototype.gitConfigContainerDir = function gitConfigContainerDir() {
    return DEFAULT_GIT_CONFIG_CONTAINER_DIR;
  };

  Orchestrator.prototype.volumeSubpathFor = function volumeSubpathFor(targetPath) {
    const resolved = path.resolve(targetPath);
    const root = path.resolve(this.dataRoot);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path is outside ORCH_DATA_DIR: ${targetPath}`);
    }
    return relative.split(path.sep).join('/');
  };

  Orchestrator.prototype.volumeMountFor = function volumeMountFor(targetPath, containerPath, readOnly = false) {
    if (!this.dataVolumeName) {
      throw new Error('ORCH_DATA_VOLUME is not configured.');
    }
    const subpath = this.volumeSubpathFor(targetPath);
    return `${this.dataVolumeName}/${subpath}=${containerPath}${readOnly ? ':ro' : ''}`;
  };

  Orchestrator.prototype.gitConfigVolumeMount = function gitConfigVolumeMount() {
    const gitDir = path.dirname(this.gitConfigGlobalPath);
    return this.volumeMountFor(gitDir, this.gitConfigContainerDir(), true);
  };

  Orchestrator.prototype.innerCodexHome = function innerCodexHome() {
    return DEFAULT_INNER_CODEX_HOME;
  };

  Orchestrator.prototype.buildCodexDockerEnv = function buildCodexDockerEnv({
    codexHomePath = this.codexHome,
    workspaceDir = '/tmp',
    volumeMounts = [],
    envOverrides = {}
  } = {}) {
    const env = this.withRuntimeEnv();
    delete env.CODEX_HOME;
    delete env.CODEX_MOUNT_PATHS;
    delete env.CODEX_MOUNT_PATHS_RO;
    delete env.CODEX_MOUNT_MAPS;
    delete env.CODEX_MOUNT_MAPS_RO;
    delete env.CODEX_ARTIFACTS_DIR;
    env.CODEX_WORKSPACE_DIR = workspaceDir;
    env.CODEX_VOLUME_MOUNTS = [
      this.volumeMountFor(codexHomePath, DEFAULT_INNER_CODEX_HOME),
      this.gitConfigVolumeMount(),
      ...volumeMounts
    ].join(',');
    env.GIT_CONFIG_GLOBAL = DEFAULT_GIT_CONFIG_CONTAINER_PATH;
    const passthroughKeys = ['GIT_CONFIG_GLOBAL', 'GH_TOKEN'];
    for (const [key, value] of Object.entries(envOverrides || {})) {
      env[key] = String(value);
      passthroughKeys.push(key);
    }
    mergePassthroughEnv(env, passthroughKeys);
    return env;
  };

  Orchestrator.prototype.getSetupStatus = async function getSetupStatus() {
    await this.init();
    await this.ensurePersistentConfig();
    const gitTokenConfigured = this.readGitToken().length > 0;
    const accounts = await this.accountStore.listAccounts();
    const accountConfigured = Array.isArray(accounts.accounts) && accounts.accounts.length > 0;
    return {
      ready: gitTokenConfigured && accountConfigured,
      gitTokenConfigured,
      accountConfigured,
      gitUserName: DEFAULT_GIT_USER_NAME,
      gitUserEmail: DEFAULT_GIT_USER_EMAIL
    };
  };

  Orchestrator.prototype.assertSetupReady = async function assertSetupReady() {
    const setup = await this.getSetupStatus();
    if (setup.ready) {
      return setup;
    }
    const missing = [];
    if (!setup.gitTokenConfigured) {
      missing.push('git token');
    }
    if (!setup.accountConfigured) {
      missing.push('codex account');
    }
    throw setupRequiredError(`Setup incomplete. Missing: ${missing.join(', ')}.`);
  };

  Orchestrator.prototype.setGitToken = async function setGitToken(token) {
    const trimmed = typeof token === 'string' ? token.trim() : '';
    const filePath = this.gitTokenPath();
    await ensureDir(path.dirname(filePath));
    if (!trimmed) {
      await removePath(filePath);
    } else {
      await fs.writeFile(filePath, `${trimmed}\n`, { mode: 0o600 });
    }
    await this.ensurePersistentConfig();
    this.notifySetupChanged();
    return this.getSetupStatus();
  };
}

module.exports = {
  DEFAULT_GIT_USER_EMAIL,
  DEFAULT_GIT_USER_NAME,
  attachSetupMethods
};
