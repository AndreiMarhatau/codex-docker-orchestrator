/* eslint-disable max-lines, max-lines-per-function */
const { readJson, removePath, pathExists, writeJson } = require('../../storage');
const { repoNameFromUrl } = require('../utils');
const { runStructuredCodex } = require('./structured-output');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('./mounts');

const COMMIT_MESSAGE_RETRY_LIMIT = 3;
const TASK_PUSH_STATUS = 'pushing';
const COMMIT_MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' }
  },
  required: ['message'],
  additionalProperties: false
};

function createTaskMutationStoppedError() {
  const error = new Error('Task operation was stopped before it completed.');
  error.code = 'TASK_BUSY';
  return error;
}

function assertTaskMutationNotStopped(claim) {
  if (claim?.stopRequested) {
    throw createTaskMutationStoppedError();
  }
}

function latestRunLabel(meta) {
  const runs = Array.isArray(meta?.runs) ? meta.runs : [];
  return runs[runs.length - 1]?.runId || null;
}

async function appendPushAgentMessage(orch, taskId, runLabel, text) {
  if (!runLabel || typeof orch.appendRunAgentMessage !== 'function') {
    return;
  }
  try {
    await orch.appendRunAgentMessage(taskId, runLabel, text);
  } catch {
    // Best-effort: push status must not depend on log append success.
  }
}

async function beginTaskPush(orch, taskId, meta, message) {
  const pushState = {
    previousError: meta.error || null,
    previousStatus: meta.status || 'completed',
    runLabel: latestRunLabel(meta)
  };
  await writeJson(orch.taskMetaPath(taskId), {
    ...meta,
    status: TASK_PUSH_STATUS,
    updatedAt: orch.now()
  });
  await appendPushAgentMessage(orch, taskId, pushState.runLabel, message);
  orch.notifyTasksChanged(taskId);
  return pushState;
}

function pushCompleteMessage(result, fallback) {
  const lines = [fallback];
  if (result?.committed && result.commitMessage) {
    lines.push(`Commit: ${result.commitMessage}`);
  }
  if (result?.prCreated && result.prUrl) {
    lines.push(`PR: ${result.prUrl}`);
  }
  return lines.join('\n');
}

async function finishTaskPush(orch, {
  taskId,
  pushState,
  result,
  error,
  transitionClaim,
  failureMessage,
  successMessage
}) {
  let meta = null;
  try {
    meta = await readJson(orch.taskMetaPath(taskId));
  } catch {
    return;
  }
  if (transitionClaim?.stopRequested || meta.status !== TASK_PUSH_STATUS) {
    return;
  }
  const updatedMeta = error
    ? {
        ...meta,
        status: 'failed',
        error: `${failureMessage}: ${error?.message || 'Unknown error'}`,
        updatedAt: orch.now()
      }
    : {
        ...meta,
        status: pushState.previousStatus || 'completed',
        error: pushState.previousError,
        updatedAt: orch.now()
      };
  await writeJson(orch.taskMetaPath(taskId), updatedMeta);
  const message = error
    ? `${failureMessage}: ${error?.message || 'Unknown error'}`
    : pushCompleteMessage(result, successMessage);
  await appendPushAgentMessage(orch, taskId, pushState.runLabel, message);
  orch.notifyTasksChanged(taskId);
}

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

async function withTaskMutationClaim(orch, taskId, options, operation) {
  const releaseTaskRunTransition = options?.transitionClaim || orch.claimTaskRunTransition(taskId);
  const ownsTaskRunTransition = !options?.transitionClaim;
  try {
    return await operation();
  } finally {
    if (ownsTaskRunTransition) {
      releaseTaskRunTransition();
    }
  }
}

function attachTaskCleanupMethods(Orchestrator) {
  Orchestrator.prototype.deleteTask = async function deleteTask(taskId) {
    return withTaskMutationClaim(this, taskId, null, async () => {
      await this.init();
      const meta = await this.reconcileTaskRuntimeState(
        taskId,
        await readJson(this.taskMetaPath(taskId))
      );
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
      try {
        await this.removeTaskDockerSidecar(taskId);
      } catch (error) {
        // Best-effort: task deletion should proceed even if Docker cleanup fails.
      }
      await removePath(this.taskDir(taskId));
      this.notifyTasksChanged(taskId);
      return undefined;
    });
  };

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

      const githubToken = this.readGitToken();
      const githubRepo = process.env.ORCH_GITHUB_REPO;
      if (!githubToken || !githubRepo) {
        this.notifyTasksChanged(taskId);
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
      this.notifyTasksChanged(taskId);
      return { pushed: true, prCreated: true, prUrl: data.html_url };
    });
  };

  Orchestrator.prototype.generateCommitMessage = async function generateCommitMessage(
    taskId,
    meta,
    env
  ) {
    const statusResult = await this.execOrThrow('git', ['-C', meta.worktreePath, 'status', '--short']);
    const statResult = await this.exec('git', [
      '-C',
      meta.worktreePath,
      'diff',
      '--cached',
      '--no-color',
      '--stat'
    ]);
    const diffResult = await this.exec('git', [
      '-C',
      meta.worktreePath,
      'diff',
      '--cached',
      '--no-color'
    ]);
    const diff = (diffResult.stdout || '').slice(0, 20_000);
    const workspaceDir = `/workspace/${repoNameFromUrl(meta.repoUrl)}`;
    const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
    const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
    const volumeMounts = await buildTaskRunVolumeMounts(this, {
      worktreePath: meta.worktreePath,
      workspaceDir,
      mirrorPath: env.mirrorPath,
      attachmentsDir: this.taskAttachmentsDir(taskId),
      hasAttachments: attachments.length > 0,
      contextRepos,
      dockerSocketDir: this.taskDockerSocketDir(taskId),
      useHostDockerSocket: Boolean(meta.useHostDockerSocket)
    });
    let previousFailure = null;
    for (let attempt = 0; attempt < COMMIT_MESSAGE_RETRY_LIMIT; attempt += 1) {
      const prompt = [
        'Generate one concise git commit message subject for the staged changes.',
        'Requirements:',
        '- Return JSON with exactly one field: message.',
        '- Use imperative mood.',
        '- Keep it non-empty and at most 100 characters.',
        '- Do not include quotes, markdown, bullets, body text, or a trailing period.',
        previousFailure
          ? `The previous message \`${previousFailure.message}\` was rejected: ${previousFailure.reason}.`
          : '',
        '',
        `Git status:\n${statusResult.stdout || '(empty)'}`,
        '',
        `Diff stat:\n${statResult.stdout || '(empty)'}`,
        '',
        `Diff excerpt:\n${diff || '(empty)'}`
      ].filter(Boolean).join('\n');
      const output = await runStructuredCodex({
        orchestrator: this,
        taskId,
        cwd: meta.worktreePath,
        workspaceDir,
        volumeMounts,
        envOverrides: buildTaskRunEnvOverrides(env.envVars, Boolean(meta.useHostDockerSocket)),
        artifactsDir: this.runArtifactsDir(taskId, meta.runs?.[meta.runs.length - 1]?.runId || 'run-1'),
        prompt,
        model: meta.model || undefined,
        reasoningEffort: meta.reasoningEffort || undefined,
        developerInstructions: '',
        outputSchema: COMMIT_MESSAGE_SCHEMA
      });
      const message = String(output.message || '').trim();
      if (message && message.length <= 100 && !/[\r\n]/.test(message)) {
        return message.replace(/\.$/, '');
      }
      previousFailure = {
        message: message || '(empty)',
        reason: !message ? 'message is empty' : 'message must be a single line under 100 characters'
      };
    }
    return `Update task ${String(taskId).slice(0, 8)}`;
  };

  Orchestrator.prototype.commitAndPushTask = async function commitAndPushTask(taskId, options = {}) {
    const releaseTaskRunTransition = options.transitionClaim || this.claimTaskRunTransition(taskId);
    const ownsTaskRunTransition = !options.transitionClaim;
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      await this.init();
      let meta = await readJson(this.taskMetaPath(taskId));
      meta = await this.reconcileTaskRuntimeState(taskId, meta);
      const env = await this.readEnv(meta.envId);
      const statusResult = await this.execOrThrow('git', [
        '-C',
        meta.worktreePath,
        'status',
        '--porcelain'
      ]);
      let committed = false;
      let commitMessage = null;
      if (statusResult.stdout.trim()) {
        await this.execOrThrow('git', ['-C', meta.worktreePath, 'add', '-A']);
        const stagedResult = await this.exec('git', [
          '-C',
          meta.worktreePath,
          'diff',
          '--cached',
          '--quiet'
        ]);
        if (stagedResult.code !== 0) {
          commitMessage = String(options.message || '').trim();
          if (!commitMessage) {
            await this.ensureActiveAuth();
            commitMessage = await this.generateCommitMessage(taskId, meta, env);
          }
          assertTaskMutationNotStopped(transitionClaim);
          await this.execOrThrow('git', ['-C', meta.worktreePath, 'config', 'user.email', 'codex@openai.com']);
          await this.execOrThrow('git', ['-C', meta.worktreePath, 'config', 'user.name', 'Codex Agent']);
          await this.execOrThrow('git', ['-C', meta.worktreePath, 'commit', '-m', commitMessage]);
          committed = true;
        }
      }
      if (!committed) {
        const gitStatus = await this.getTaskGitStatus(meta);
        if (gitStatus?.pushed === true) {
          this.notifyTasksChanged(taskId);
          return { pushed: true, prCreated: false, committed: false, commitMessage: null };
        }
      }
      assertTaskMutationNotStopped(transitionClaim);
      const pushResult = await this.pushTask(taskId, {
        transitionClaim: releaseTaskRunTransition
      });
      this.notifyTasksChanged(taskId);
      return { ...pushResult, committed, commitMessage };
    } finally {
      if (ownsTaskRunTransition) {
        releaseTaskRunTransition();
      }
    }
  };

  Orchestrator.prototype.startPushTask = async function startPushTask(taskId) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    let scheduled = false;
    try {
      await this.init();
      let meta = await readJson(this.taskMetaPath(taskId));
      meta = await this.reconcileTaskRuntimeState(taskId, meta);
      this.markTaskRunTransitionRuntimeActive(transitionClaim);
      const pushState = await beginTaskPush(this, taskId, meta, 'Push started.');
      scheduled = true;
      void this.pushTask(taskId, { transitionClaim: releaseTaskRunTransition })
        .then((result) =>
          finishTaskPush(this, {
            taskId,
            pushState,
            result,
            transitionClaim,
            failureMessage: 'Push failed',
            successMessage: 'Push completed.'
          })
        )
        .catch((error) =>
          finishTaskPush(this, {
            taskId,
            pushState,
            error,
            transitionClaim,
            failureMessage: 'Push failed',
            successMessage: 'Push completed.'
          })
        )
        .finally(() => releaseTaskRunTransition());
      return { started: true };
    } finally {
      if (!scheduled) {
        releaseTaskRunTransition();
      }
    }
  };

  Orchestrator.prototype.startCommitAndPushTask = async function startCommitAndPushTask(
    taskId,
    options = {}
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    let scheduled = false;
    try {
      await this.init();
      let meta = await readJson(this.taskMetaPath(taskId));
      meta = await this.reconcileTaskRuntimeState(taskId, meta);
      this.markTaskRunTransitionRuntimeActive(transitionClaim);
      const pushState = await beginTaskPush(this, taskId, meta, 'Commit & push started.');
      scheduled = true;
      void this.commitAndPushTask(taskId, {
        message: options.message,
        transitionClaim: releaseTaskRunTransition
      })
        .then((result) =>
          finishTaskPush(this, {
            taskId,
            pushState,
            result,
            transitionClaim,
            failureMessage: 'Commit & push failed',
            successMessage: 'Commit & push completed.'
          })
        )
        .catch((error) =>
          finishTaskPush(this, {
            taskId,
            pushState,
            error,
            transitionClaim,
            failureMessage: 'Commit & push failed',
            successMessage: 'Commit & push completed.'
          })
        )
        .finally(() => releaseTaskRunTransition());
      return { started: true };
    } finally {
      if (!scheduled) {
        releaseTaskRunTransition();
      }
    }
  };
}

module.exports = {
  attachTaskCleanupMethods,
  cleanupContextRepos
};
