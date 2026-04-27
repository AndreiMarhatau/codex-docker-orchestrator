const { readJson } = require('../../../../shared/filesystem/storage');
const { assertTaskMutationNotStopped, withTaskMutationClaim } = require('../mutation-claim');

async function createPullRequest(orchestrator, taskId, meta) {
  const githubToken = orchestrator.readGitToken();
  const githubRepo = process.env.ORCH_GITHUB_REPO;
  if (!githubToken || !githubRepo) {
    orchestrator.notifyTasksChanged(taskId);
    return { pushed: true, prCreated: false };
  }
  const env = await orchestrator.readEnv(meta.envId);
  const response = await orchestrator.fetch(`https://api.github.com/repos/${githubRepo}/pulls`, {
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
  orchestrator.notifyTasksChanged(taskId);
  return { pushed: true, prCreated: true, prUrl: data.html_url };
}

function attachPushTaskMethod(Orchestrator) {
  Orchestrator.prototype.pushTask = async function pushTask(taskId, options = {}) {
    return withTaskMutationClaim(this, taskId, options, async () => {
      const meta = await this.reconcileTaskRuntimeState(
        taskId,
        await readJson(this.taskMetaPath(taskId))
      );
      await this.execOrThrow('git', [
        '-C',
        meta.worktreePath,
        '-c',
        'remote.origin.mirror=false',
        'push',
        'origin',
        meta.branchName
      ]);
      return createPullRequest(this, taskId, meta);
    });
  };
}

async function commitTaskChanges(orchestrator, options) {
  const statusResult = await orchestrator.execOrThrow('git', [
    '-C',
    options.meta.worktreePath,
    'status',
    '--porcelain'
  ]);
  if (!statusResult.stdout.trim()) {
    return { committed: false, commitMessage: null };
  }
  await orchestrator.execOrThrow('git', ['-C', options.meta.worktreePath, 'add', '-A']);
  const stagedResult = await orchestrator.exec('git', [
    '-C',
    options.meta.worktreePath,
    'diff',
    '--cached',
    '--quiet'
  ]);
  if (stagedResult.code === 0) {
    return { committed: false, commitMessage: null };
  }
  let commitMessage = String(options.message || '').trim();
  if (!commitMessage) {
    await orchestrator.ensureActiveAuth();
    commitMessage = await orchestrator.generateCommitMessage(
      options.taskId,
      options.meta,
      options.env
    );
  }
  assertTaskMutationNotStopped(options.transitionClaim);
  await orchestrator.execOrThrow('git', [
    '-C',
    options.meta.worktreePath,
    'config',
    'user.email',
    'codex@openai.com'
  ]);
  await orchestrator.execOrThrow('git', [
    '-C',
    options.meta.worktreePath,
    'config',
    'user.name',
    'Codex Agent'
  ]);
  await orchestrator.execOrThrow('git', ['-C', options.meta.worktreePath, 'commit', '-m', commitMessage]);
  return { committed: true, commitMessage };
}

function attachCommitAndPushTaskMethod(Orchestrator) {
  Orchestrator.prototype.commitAndPushTask = async function commitAndPushTask(taskId, options = {}) {
    const releaseTaskRunTransition = options.transitionClaim || this.claimTaskRunTransition(taskId);
    const ownsTaskRunTransition = !options.transitionClaim;
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      await this.init();
      let meta = await readJson(this.taskMetaPath(taskId));
      meta = await this.reconcileTaskRuntimeState(taskId, meta);
      const env = await this.readEnv(meta.envId);
      const commit = await commitTaskChanges(this, { ...options, taskId, meta, env, transitionClaim });
      if (!commit.committed) {
        const gitStatus = await this.getTaskGitStatus(meta);
        if (gitStatus?.pushed === true) {
          this.notifyTasksChanged(taskId);
          return { pushed: true, prCreated: false, ...commit };
        }
      }
      assertTaskMutationNotStopped(transitionClaim);
      const pushResult = await this.pushTask(taskId, { transitionClaim: releaseTaskRunTransition });
      this.notifyTasksChanged(taskId);
      return { ...pushResult, ...commit };
    } finally {
      if (ownsTaskRunTransition) {
        releaseTaskRunTransition();
      }
    }
  };
}

module.exports = {
  attachCommitAndPushTaskMethod,
  attachPushTaskMethod
};
