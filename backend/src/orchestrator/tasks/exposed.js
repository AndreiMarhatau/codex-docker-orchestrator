const { repoNameFromUrl } = require('../utils');

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
    _taskId,
    { contextRepos = [] } = {}
  ) {
    const repoAliases = buildRepoAliases(contextRepos);

    return {
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
