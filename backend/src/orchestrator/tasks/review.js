/* eslint-disable max-lines */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readJson, writeJson } = require('../../storage');
const { AppServerClient } = require('../app-server-client');
const { buildRunEnv } = require('./run-helpers');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('./mounts');
const { repoNameFromUrl } = require('../utils');
const { createBoundedChildShutdown } = require('./process-shutdown');

const REVIEW_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const REVIEW_REQUEST_TIMEOUT_MS = 60_000;
const AUTO_REVIEW_FIX_PROMPT =
  'Fix the following comments. If any of them is worth not fixing due to conflict with user instructions or too broad changes, just mention it without fixing.';

function normalizeReviewTarget(input = {}) {
  const type = input.type || input.targetType || 'uncommittedChanges';
  if (type === 'uncommittedChanges') {
    return { type };
  }
  if (type === 'baseBranch') {
    const branch = String(input.branch || '').trim();
    if (!branch) {
      throw new Error('baseBranch review requires a branch.');
    }
    return { type, branch };
  }
  if (type === 'commit') {
    const sha = String(input.sha || input.commitSha || '').trim();
    if (!sha) {
      throw new Error('commit review requires a commit sha.');
    }
    const title = String(input.title || input.commitTitle || '').trim();
    return { type, sha, title: title || null };
  }
  if (type === 'custom') {
    const instructions = String(input.instructions || '').trim();
    if (!instructions) {
      throw new Error('custom review requires instructions.');
    }
    return { type, instructions };
  }
  throw new Error('Unknown review target.');
}

function reviewTargetLabel(target) {
  if (target.type === 'uncommittedChanges') {
    return 'uncommitted changes';
  }
  if (target.type === 'baseBranch') {
    return `changes against ${target.branch}`;
  }
  if (target.type === 'commit') {
    return `commit ${target.sha}`;
  }
  return 'custom review';
}

function hasActionableReviewFeedback(reviewText) {
  const text = String(reviewText || '').trim();
  if (!text) {
    return false;
  }
  const lower = text.toLowerCase();
  const noFindingPatterns = [
    /^no findings\.?$/,
    /^no issues found\.?$/,
    /^looks good\.?$/,
    /^looks solid\.?$/,
    /^nothing to fix\.?$/
  ];
  if (text.length < 500 && noFindingPatterns.some((pattern) => pattern.test(lower))) {
    return false;
  }
  return true;
}

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

function waitForReviewCompletion(client) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Codex review to complete.'));
    }, REVIEW_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      client.off('notification', handleNotification);
      client.off('close', handleClose);
    };

    const handleNotification = (message) => {
      if (message.method !== 'turn/completed') {
        return;
      }
      cleanup();
      resolve(message.params?.turn || null);
    };

    const handleClose = (code, signal) => {
      cleanup();
      reject(new Error(`Codex app-server exited before review completed (${signal || code}).`));
    };

    client.on('notification', handleNotification);
    client.on('close', handleClose);
  });
}

async function runCodexReview({
  orchestrator,
  taskId,
  meta,
  target,
  developerInstructions,
  workspaceDir,
  volumeMounts,
  envOverrides,
  artifactsDir
}) {
  const env = buildRunEnv({
    orchestrator,
    workspaceDir,
    artifactsDir,
    volumeMounts,
    envOverrides
  });
  const useProcessGroup = process.platform !== 'win32';
  const child = orchestrator.spawn('codex-docker', ['app-server'], {
    cwd: meta.worktreePath,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: useProcessGroup
  });
  const shutdown = createBoundedChildShutdown({
    child,
    useProcessGroup,
    stopTimeoutMs: orchestrator.appServerShutdownTimeoutMs
  });
  const unregisterCancel =
    orchestrator.registerTaskRunTransitionCancel?.(taskId, shutdown.stop) || (() => {});
  const client = new AppServerClient({ child, requestTimeoutMs: REVIEW_REQUEST_TIMEOUT_MS });
  let reviewText = '';
  let stderr = '';
  client.on('stderr', (text) => {
    stderr += text;
  });
  client.on('notification', (message) => {
    const item = message.params?.item;
    if (message.method === 'item/completed' && item?.type === 'exitedReviewMode') {
      reviewText = item.review || '';
    }
    if (message.method === 'item/completed' && item?.type === 'agentMessage' && item.text) {
      reviewText = reviewText || item.text;
    }
  });

  try {
    await client.initialize();
    await client.request(
      'thread/resume',
      {
        threadId: meta.threadId,
        cwd: workspaceDir,
        approvalPolicy: 'never',
        sandbox: 'danger-full-access',
        model: meta.model || undefined,
        developerInstructions,
        persistExtendedHistory: true
      },
      { timeoutMs: REVIEW_REQUEST_TIMEOUT_MS }
    );
    const completionPromise = waitForReviewCompletion(client);
    await client.request(
      'review/start',
      {
        threadId: meta.threadId,
        delivery: 'detached',
        target
      },
      { timeoutMs: REVIEW_REQUEST_TIMEOUT_MS }
    );
    await completionPromise;
    if (!reviewText.trim() && stderr.trim()) {
      throw new Error(stderr.trim());
    }
    return reviewText.trim();
  } finally {
    unregisterCancel();
    shutdown.stop('SIGTERM');
  }
}

function appendReviewToRun(run, reviewEntry) {
  return {
    ...run,
    reviews: [...(Array.isArray(run.reviews) ? run.reviews : []), reviewEntry]
  };
}

async function appendRunAgentMessage(orchestrator, taskId, runLabel, text) {
  const logPath = path.join(orchestrator.taskLogsDir(taskId), `${runLabel}.jsonl`);
  const payload = {
    type: 'item.completed',
    item: {
      id: `review-${crypto.randomUUID()}`,
      type: 'agent_message',
      text
    }
  };
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`);
}

async function prepareReviewRuntime(orchestrator, taskId, meta) {
  const env = await orchestrator.readEnv(meta.envId);
  const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
  const contextRepos = Array.isArray(meta.contextRepos) ? meta.contextRepos : [];
  const exposedPaths = await orchestrator.prepareTaskExposedPaths(taskId, {
    contextRepos,
    attachments
  });
  const developerInstructions = orchestrator.buildOrchestratorInstructions({
    useHostDockerSocket: Boolean(meta.useHostDockerSocket),
    contextRepos,
    attachments,
    envVars: env.envVars,
    exposedPaths
  });
  const workspaceDir = `/workspace/${repoNameFromUrl(meta.repoUrl)}`;
  const volumeMounts = await buildTaskRunVolumeMounts(orchestrator, {
    worktreePath: meta.worktreePath,
    workspaceDir,
    mirrorPath: env.mirrorPath,
    attachmentsDir: orchestrator.taskAttachmentsDir(taskId),
    hasAttachments: attachments.length > 0,
    contextRepos: exposedPaths.contextRepos || [],
    dockerSocketDir: orchestrator.taskDockerSocketDir(taskId),
    useHostDockerSocket: Boolean(meta.useHostDockerSocket)
  });
  return {
    developerInstructions,
    workspaceDir,
    volumeMounts,
    envOverrides: buildTaskRunEnvOverrides(env.envVars, Boolean(meta.useHostDockerSocket)),
    artifactsDir: orchestrator.runArtifactsDir(taskId, meta.runs?.[meta.runs.length - 1]?.runId || 'run-1')
  };
}

function attachTaskReviewMethods(Orchestrator) {
  Orchestrator.prototype.appendRunAgentMessage = async function appendRunAgentMessageMethod(
    taskId,
    runLabel,
    text
  ) {
    await appendRunAgentMessage(this, taskId, runLabel, text);
  };

  Orchestrator.prototype.runTaskReview = async function runTaskReview(taskId, targetInput) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      await this.init();
      let meta = await readJson(this.taskMetaPath(taskId));
      meta = await this.reconcileTaskRuntimeState(taskId, meta);
      if (!meta.threadId) {
        throw new Error('Cannot review task without a Codex thread.');
      }
      const target = normalizeReviewTarget(targetInput);
      const latestRun = meta.runs?.[meta.runs.length - 1] || null;
      if (!latestRun) {
        throw new Error('Cannot review task without a run.');
      }
      await this.ensureActiveAuth();
      const runtime = await prepareReviewRuntime(this, taskId, meta);
      const review = await runCodexReview({
        orchestrator: this,
        taskId,
        meta,
        target,
        ...runtime
      });
      assertTaskMutationNotStopped(transitionClaim);
      const reviewEntry = {
        id: crypto.randomUUID(),
        target,
        automatic: false,
        createdAt: this.now(),
        review
      };
      const text = `Review: ${reviewTargetLabel(target)}\n\n${review || 'No review output.'}`;
      await appendRunAgentMessage(this, taskId, latestRun.runId, text);
      meta = await readJson(this.taskMetaPath(taskId));
      const runIndex = meta.runs.findIndex((run) => run.runId === latestRun.runId);
      if (runIndex !== -1) {
        meta.runs[runIndex] = appendReviewToRun(meta.runs[runIndex], reviewEntry);
        meta.updatedAt = this.now();
        await writeJson(this.taskMetaPath(taskId), meta);
      }
      this.notifyTasksChanged(taskId);
      return { review, target };
    } finally {
      releaseTaskRunTransition();
    }
  };

  Orchestrator.prototype.runAutoReviewForTask = async function runAutoReviewForTask(
    taskId,
    runLabel
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      await this.init();
      let meta = await readJson(this.taskMetaPath(taskId));
      meta = await this.reconcileTaskRuntimeState(taskId, meta);
      if (meta.status !== 'completed' || !meta.threadId) {
        return null;
      }
      const gitStatus = await this.getTaskGitStatus(meta);
      if (gitStatus?.dirty !== true) {
        return null;
      }
      const target = { type: 'uncommittedChanges' };
      await this.ensureActiveAuth();
      const runtime = await prepareReviewRuntime(this, taskId, meta);
      const review = await runCodexReview({
        orchestrator: this,
        taskId,
        meta,
        target,
        ...runtime
      });
      assertTaskMutationNotStopped(transitionClaim);
      const reviewEntry = {
        id: crypto.randomUUID(),
        target,
        automatic: true,
        createdAt: this.now(),
        review
      };
      const text = `Auto review: ${reviewTargetLabel(target)}\n\n${review || 'No review output.'}`;
      await appendRunAgentMessage(this, taskId, runLabel, text);
      meta = await readJson(this.taskMetaPath(taskId));
      const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
      if (runIndex !== -1) {
        meta.runs[runIndex] = appendReviewToRun(meta.runs[runIndex], reviewEntry);
        meta.updatedAt = this.now();
        await writeJson(this.taskMetaPath(taskId), meta);
      }
      this.notifyTasksChanged(taskId);
      if (!hasActionableReviewFeedback(review)) {
        return { review, resumed: false };
      }
      assertTaskMutationNotStopped(transitionClaim);
      const fixPrompt = `${AUTO_REVIEW_FIX_PROMPT}\n\n${review}`;
      return this.resumeTask(taskId, fixPrompt, {
        transitionClaim: releaseTaskRunTransition,
        autoReviewRemaining: 0
      });
    } finally {
      releaseTaskRunTransition();
    }
  };
}

module.exports = {
  attachTaskReviewMethods,
  hasActionableReviewFeedback,
  normalizeReviewTarget
};
