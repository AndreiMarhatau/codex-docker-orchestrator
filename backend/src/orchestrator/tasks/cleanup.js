const { readJson, removePath, pathExists } = require('../../storage');
const { cleanupTaskSkill } = require('./skills');

async function removeWorktree({ exec, mirrorPath, worktreePath }) {
  const result = await exec('git', [
    '--git-dir',
    mirrorPath,
    'worktree',
    'remove',
    '--force',
    worktreePath
  ]);
  if (result.code !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    const ignorable =
      message.includes('not a working tree') ||
      message.includes('does not exist') ||
      message.includes('No such file or directory');
    if (!ignorable) {
      throw new Error(message || 'Failed to remove worktree');
    }
  }
  if (await pathExists(worktreePath)) {
    await removePath(worktreePath);
  }
  await exec('git', ['--git-dir', mirrorPath, 'worktree', 'prune', '--expire', 'now']);
}

async function cleanupContextRepos(orch, contextRepos) {
  for (const contextRepo of contextRepos) {
    const contextPath = contextRepo?.worktreePath;
    if (!contextPath) {
      continue;
    }
    await orch.ensureOwnership(contextPath);
    let contextEnv = null;
    try {
      contextEnv = await orch.readEnv(contextRepo.envId);
    } catch (error) {
      contextEnv = null;
    }
    if (contextEnv?.mirrorPath) {
      await removeWorktree({
        exec: orch.exec.bind(orch),
        mirrorPath: contextEnv.mirrorPath,
        worktreePath: contextPath
      });
    } else if (await pathExists(contextPath)) {
      await removePath(contextPath);
    }
  }
}

function attachTaskCleanupMethods(Orchestrator) {
  Orchestrator.prototype.deleteTask = async function deleteTask(taskId) {
    await this.init();
    const meta = await readJson(this.taskMetaPath(taskId));
    const env = await this.readEnv(meta.envId);
    const worktreePath = meta.worktreePath;
    const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
    await this.ensureOwnership(worktreePath);
    await this.ensureOwnership(this.taskDir(taskId));
    await cleanupContextRepos(this, contextRepos);
    await removeWorktree({
      exec: this.exec.bind(this),
      mirrorPath: env.mirrorPath,
      worktreePath
    });
    await removePath(this.taskDir(taskId));
    cleanupTaskSkill(this.codexHome, taskId);
  };

  Orchestrator.prototype.pushTask = async function pushTask(taskId) {
    const meta = await readJson(this.taskMetaPath(taskId));
    await this.execOrThrow('git', [
      '-C',
      meta.worktreePath,
      '-c',
      'remote.origin.mirror=false',
      'push',
      'origin',
      meta.branchName
    ]);

    const githubToken = process.env.ORCH_GITHUB_TOKEN;
    const githubRepo = process.env.ORCH_GITHUB_REPO;
    if (!githubToken || !githubRepo) {
      return { pushed: true, prCreated: false };
    }

    const env = await this.readEnv(meta.envId);
    const response = await this.fetch(`https://api.github.com/repos/${githubRepo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        title: `Codex task ${meta.taskId}`,
        head: meta.branchName,
        base: env.defaultBranch,
        body: `Automated PR for task ${meta.taskId}.`
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to create PR');
    }

    const data = await response.json();
    return { pushed: true, prCreated: true, prUrl: data.html_url };
  };
}

module.exports = {
  attachTaskCleanupMethods
};
