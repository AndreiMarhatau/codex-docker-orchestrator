const path = require('node:path');
const fsp = require('node:fs/promises');
const { ensureDir } = require('../../storage');
const { repoNameFromUrl } = require('../utils');

async function removePathIfExists(targetPath) {
  try {
    const stat = await fsp.lstat(targetPath);
    if (stat.isSymbolicLink() || stat.isFile()) {
      await fsp.unlink(targetPath);
      return;
    }
    await fsp.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function ensureSymlink(targetPath, linkPath) {
  await removePathIfExists(linkPath);
  await fsp.symlink(targetPath, linkPath);
}

function buildRepoAliases(contextRepos) {
  if (!Array.isArray(contextRepos) || contextRepos.length === 0) {
    return [];
  }
  const used = new Set();
  return contextRepos.map((repo) => {
    let baseName = repoNameFromUrl(repo?.repoUrl || repo?.envId || '');
    if (!baseName) {
      baseName = 'repo';
    }
    let aliasName = baseName;
    let counter = 1;
    while (used.has(aliasName)) {
      counter += 1;
      aliasName = `${baseName}-${counter}`;
    }
    used.add(aliasName);
    return {
      envId: repo?.envId || null,
      repoUrl: repo?.repoUrl || null,
      ref: repo?.ref || null,
      worktreePath: repo?.worktreePath || null,
      aliasName
    };
  });
}

function attachTaskExposedMethods(Orchestrator) {
  Orchestrator.prototype.prepareTaskExposedPaths = async function prepareTaskExposedPaths(
    taskId,
    { contextRepos = [], codexHome } = {}
  ) {
    const homeDir = this.taskHomeDir(taskId);
    await ensureDir(homeDir);

    if (codexHome) {
      await ensureSymlink(codexHome, path.join(homeDir, '.codex'));
    }

    const attachmentsDir = this.taskAttachmentsDir(taskId);
    await ensureDir(attachmentsDir);
    const repoAliases = buildRepoAliases(contextRepos);

    const uploadsPath = path.join(homeDir, 'uploads');
    const repositoriesPath = path.join(homeDir, 'repositories');
    const repositoriesAliasPath = path.join(homeDir, 'repos');
    await Promise.all([
      removePathIfExists(uploadsPath),
      removePathIfExists(repositoriesPath),
      removePathIfExists(repositoriesAliasPath)
    ]);

    return {
      homeDir,
      uploadsPath: '/attachments',
      repositoriesPath: '/readonly',
      repositoriesAliasPath: '/readonly',
      readonlyAttachmentsPath: '/attachments',
      readonlyRepositoriesPath: '/readonly',
      contextRepos: repoAliases
    };
  };
}

module.exports = {
  attachTaskExposedMethods
};
