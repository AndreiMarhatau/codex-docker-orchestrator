/* eslint-disable max-lines */
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readJson, writeJson } = require('../../storage');
const { AppServerClient } = require('../app-server-client');
const { buildCodexAppServerArgs } = require('../app-server-args');
const { buildRunEnv } = require('./run-helpers');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('./mounts');
const { repoNameFromUrl } = require('../utils');
const { createBoundedChildShutdown } = require('./process-shutdown');

const REVIEW_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const REVIEW_REQUEST_TIMEOUT_MS = 60_000;
const AUTO_REVIEW_FIX_PROMPT_PATH = path.join(__dirname, 'auto-review-fix-prompt.txt');

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
  const child = orchestrator.spawn('codex-docker', buildCodexAppServerArgs(), {
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

async function restoreTaskAfterReview(orchestrator, taskId, reviewState, claim) {
  if (!reviewState || claim?.stopRequested) {
    return;
  }
  let meta = await readJson(orchestrator.taskMetaPath(taskId));
  if (meta.status !== 'reviewing') {
    return;
  }
  meta = {
    ...meta,
    status: reviewState.previousStatus || 'completed',
    updatedAt: orchestrator.now()
  };
  await writeJson(orchestrator.taskMetaPath(taskId), meta);
  orchestrator.notifyTasksChanged(taskId);
}

async function appendRunItem(orchestrator, taskId, runLabel, item) {
  const logPath = path.join(orchestrator.taskLogsDir(taskId), `${runLabel}.jsonl`);
  const payload = {
    type: 'item.completed',
    item
  };
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`);
}

async function appendRunAgentMessage(orchestrator, taskId, runLabel, text) {
  await appendRunItem(orchestrator, taskId, runLabel, {
    id: `message-${crypto.randomUUID()}`,
    type: 'agent_message',
    text
  });
}

async function appendRunReviewMessage(orchestrator, taskId, runLabel, {
  text,
  phase,
  target,
  automatic
}) {
  await appendRunItem(orchestrator, taskId, runLabel, {
    id: `review-${crypto.randomUUID()}`,
    type: 'review',
    phase,
    target,
    automatic: automatic === true,
    text
  });
}

async function beginTaskReview(orchestrator, {
  taskId,
  meta,
  latestRun,
  target,
  automatic
}) {
  const reviewState = {
    previousStatus: meta.status || 'completed',
    runId: latestRun.runId
  };
  const startedAt = orchestrator.now();
  await writeJson(orchestrator.taskMetaPath(taskId), {
    ...meta,
    status: 'reviewing',
    updatedAt: startedAt
  });
  try {
    const prefix = automatic ? 'Auto review started' : 'Review started';
    await appendRunReviewMessage(orchestrator, taskId, latestRun.runId, {
      phase: 'started',
      target,
      automatic,
      text: `${prefix}: ${reviewTargetLabel(target)}`
    });
  } catch (error) {
    await restoreTaskAfterReview(orchestrator, taskId, reviewState);
    throw error;
  }
  orchestrator.notifyTasksChanged(taskId);
  return reviewState;
}

async function recordTaskReview(orchestrator, {
  taskId,
  runLabel,
  target,
  automatic,
  review
}) {
  const reviewEntry = {
    id: crypto.randomUUID(),
    target,
    automatic,
    createdAt: orchestrator.now(),
    review
  };
  const prefix = automatic ? 'Auto review' : 'Review';
  const text = `${prefix}: ${reviewTargetLabel(target)}\n\n${review || 'No review output.'}`;
  await appendRunReviewMessage(orchestrator, taskId, runLabel, {
    phase: 'completed',
    target,
    automatic,
    text
  });
  const meta = await readJson(orchestrator.taskMetaPath(taskId));
  const runIndex = meta.runs.findIndex((run) => run.runId === runLabel);
  if (runIndex !== -1) {
    meta.runs[runIndex] = appendReviewToRun(meta.runs[runIndex], reviewEntry);
    meta.updatedAt = orchestrator.now();
    await writeJson(orchestrator.taskMetaPath(taskId), meta);
  }
  orchestrator.notifyTasksChanged(taskId);
  return { review, target };
}

async function appendReviewFailure(orchestrator, {
  taskId,
  runLabel,
  automatic,
  error
}) {
  const prefix = automatic ? 'Auto review failed' : 'Review failed';
  const message = error?.message || 'Unknown error';
  await appendRunReviewMessage(orchestrator, taskId, runLabel, {
    phase: 'failed',
    target: null,
    automatic,
    text: `${prefix}: ${message}`
  });
  orchestrator.notifyTasksChanged(taskId);
}

async function buildAutoReviewFixPrompt(review) {
  const template = await fs.readFile(AUTO_REVIEW_FIX_PROMPT_PATH, 'utf8');
  return `${template.trimEnd()}\n\n${review || ''}`.trim();
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

async function executeTaskReview(orchestrator, {
  taskId,
  meta,
  target,
  runLabel,
  automatic,
  transitionClaim
}) {
  assertTaskMutationNotStopped(transitionClaim);
  await orchestrator.ensureActiveAuth();
  assertTaskMutationNotStopped(transitionClaim);
  const runtime = await prepareReviewRuntime(orchestrator, taskId, meta);
  const review = await runCodexReview({
    orchestrator,
    taskId,
    meta,
    target,
    ...runtime
  });
  assertTaskMutationNotStopped(transitionClaim);
  return recordTaskReview(orchestrator, {
    taskId,
    runLabel,
    target,
    automatic,
    review
  });
}

async function prepareManualReviewContext(orchestrator, {
  taskId,
  targetInput,
  transitionClaim
}) {
  await orchestrator.init();
  let meta = await readJson(orchestrator.taskMetaPath(taskId));
  meta = await orchestrator.reconcileTaskRuntimeState(taskId, meta);
  if (!meta.threadId) {
    throw new Error('Cannot review task without a Codex thread.');
  }
  const target = normalizeReviewTarget(targetInput);
  const latestRun = meta.runs?.[meta.runs.length - 1] || null;
  if (!latestRun) {
    throw new Error('Cannot review task without a run.');
  }
  orchestrator.markTaskRunTransitionRuntimeActive(transitionClaim);
  const reviewState = await beginTaskReview(orchestrator, {
    taskId,
    meta,
    latestRun,
    target,
    automatic: false
  });
  return { latestRun, meta, reviewState, target };
}

async function executeManualReviewContext(orchestrator, {
  taskId,
  meta,
  latestRun,
  reviewState,
  target,
  transitionClaim
}) {
  try {
    return await executeTaskReview(orchestrator, {
      taskId,
      meta,
      target,
      runLabel: latestRun.runId,
      automatic: false,
      transitionClaim
    });
  } finally {
    await restoreTaskAfterReview(orchestrator, taskId, reviewState, transitionClaim);
  }
}

async function prepareAutoReviewContext(orchestrator, {
  taskId,
  runLabel,
  transitionClaim
}) {
  await orchestrator.init();
  let meta = await readJson(orchestrator.taskMetaPath(taskId));
  meta = await orchestrator.reconcileTaskRuntimeState(taskId, meta);
  if (meta.status !== 'completed' || !meta.threadId) {
    return null;
  }
  const gitStatus = await orchestrator.getTaskGitStatus(meta);
  if (gitStatus?.dirty !== true) {
    return null;
  }
  const target = { type: 'uncommittedChanges' };
  const latestRun = meta.runs?.find((run) => run.runId === runLabel) ||
    meta.runs?.[meta.runs.length - 1] ||
    null;
  if (!latestRun) {
    return null;
  }
  orchestrator.markTaskRunTransitionRuntimeActive(transitionClaim);
  const reviewState = await beginTaskReview(orchestrator, {
    taskId,
    meta,
    latestRun,
    target,
    automatic: true
  });
  return { latestRun, meta, reviewState, target };
}

async function executeAutoReviewContext(orchestrator, {
  taskId,
  runLabel,
  releaseTaskRunTransition,
  reviewState,
  meta,
  target,
  transitionClaim
}) {
  let result = null;
  try {
    result = await executeTaskReview(orchestrator, {
      taskId,
      meta,
      target,
      runLabel,
      automatic: true,
      transitionClaim
    });
  } finally {
    await restoreTaskAfterReview(orchestrator, taskId, reviewState, transitionClaim);
  }
  const review = result?.review || '';
  if (!review.trim()) {
    return { review, resumed: false };
  }
  assertTaskMutationNotStopped(transitionClaim);
  const fixPrompt = await buildAutoReviewFixPrompt(review);
  return orchestrator.resumeTask(taskId, fixPrompt, {
    transitionClaim: releaseTaskRunTransition
  });
}

function attachTaskReviewMethods(Orchestrator) {
  Orchestrator.prototype.appendRunAgentMessage = async function appendRunAgentMessageMethod(
    taskId,
    runLabel,
    text
  ) {
    await appendRunAgentMessage(this, taskId, runLabel, text);
  };

  Orchestrator.prototype.appendRunReviewMessage = async function appendRunReviewMessageMethod(
    taskId,
    runLabel,
    options
  ) {
    await appendRunReviewMessage(this, taskId, runLabel, options);
  };

  Orchestrator.prototype.runTaskReview = async function runTaskReview(
    taskId,
    targetInput,
    options = {}
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    let scheduled = false;
    try {
      const context = await prepareManualReviewContext(this, {
        taskId,
        targetInput,
        transitionClaim
      });
      const execute = async () => {
        return executeManualReviewContext(this, { taskId, transitionClaim, ...context });
      };
      if (options.defer === true) {
        scheduled = true;
        void execute()
          .catch((error) =>
            appendReviewFailure(this, {
              taskId,
              runLabel: context.latestRun.runId,
              automatic: false,
              error
            }).catch(() => {})
          )
          .finally(() => releaseTaskRunTransition());
        return { started: true, target: context.target };
      }
      return await execute();
    } finally {
      if (!scheduled) {
        releaseTaskRunTransition();
      }
    }
  };

  Orchestrator.prototype.startTaskReview = async function startTaskReview(taskId, targetInput) {
    return this.runTaskReview(taskId, targetInput, { defer: true });
  };

  Orchestrator.prototype.runAutoReviewForTask = async function runAutoReviewForTask(
    taskId,
    runLabel
  ) {
    const releaseTaskRunTransition = this.claimTaskRunTransition(taskId);
    const transitionClaim = releaseTaskRunTransition.claim;
    try {
      const context = await prepareAutoReviewContext(this, {
        taskId,
        runLabel,
        transitionClaim
      });
      if (!context) {
        return null;
      }
      return await executeAutoReviewContext(this, {
        taskId,
        runLabel,
        releaseTaskRunTransition,
        transitionClaim,
        ...context
      });
    } finally {
      releaseTaskRunTransition();
    }
  };
}

module.exports = {
  attachTaskReviewMethods,
  normalizeReviewTarget
};
