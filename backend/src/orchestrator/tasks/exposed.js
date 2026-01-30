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

async function clearDirectory(dirPath) {
  try {
    const entries = await fsp.readdir(dirPath);
    await Promise.all(entries.map((entry) => removePathIfExists(path.join(dirPath, entry))));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
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
    { contextRepos = [], attachments = [], codexHome } = {}
  ) {
    const homeDir = this.taskHomeDir(taskId);
    await ensureDir(homeDir);

    if (codexHome) {
      await ensureSymlink(codexHome, path.join(homeDir, '.codex'));
    }

    const attachmentsDir = this.taskAttachmentsDir(taskId);
    await ensureDir(attachmentsDir);

    const uploadsPath = path.join(homeDir, 'uploads');
    if (attachments.length > 0) {
      await ensureSymlink(attachmentsDir, uploadsPath);
    } else {
      await removePathIfExists(uploadsPath);
      await ensureDir(uploadsPath);
      await fsp.chmod(uploadsPath, 0o555);
    }

    const repositoriesDir = path.join(homeDir, 'repositories');
    await ensureDir(repositoriesDir);
    await fsp.chmod(repositoriesDir, 0o755);
    await clearDirectory(repositoriesDir);

    const repositoriesAliasPath = path.join(homeDir, 'repos');
    await ensureSymlink(repositoriesDir, repositoriesAliasPath);

    const repoAliases = buildRepoAliases(contextRepos);
    for (const repo of repoAliases) {
      if (!repo.worktreePath) {
        continue;
      }
      const aliasPath = path.join(repositoriesDir, repo.aliasName);
      await ensureSymlink(repo.worktreePath, aliasPath);
      repo.aliasPath = aliasPath;
    }
    await fsp.chmod(repositoriesDir, 0o555);

    return {
      homeDir,
      uploadsPath: path.join(homeDir, 'uploads'),
      repositoriesPath: path.join(homeDir, 'repositories'),
      repositoriesAliasPath: path.join(homeDir, 'repos'),
      contextRepos: repoAliases
    };
  };
}

module.exports = {
  attachTaskExposedMethods
};
