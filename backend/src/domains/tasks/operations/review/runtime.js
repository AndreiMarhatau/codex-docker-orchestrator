const fs = require('node:fs/promises');
const { AppServerClient } = require('../../../../shared/codex/app-server-client');
const { buildCodexAppServerArgs } = require('../../../../shared/codex/app-server-args');
const {
  buildRunEnv,
  resolveCodexRunImageName
} = require('../../../../shared/codex/run-env');
const { createBoundedChildShutdown } = require('../../../../shared/process/shutdown');
const { DEFAULT_AUTO_REVIEW_FIX_PROMPT_TEMPLATE_FILE } = require('../../../../shared/config/constants');
const { renderTemplate } = require('../../../../orchestrator/context');
const { repoNameFromUrl } = require('../../../../orchestrator/utils');
const { buildTaskRunEnvOverrides, buildTaskRunVolumeMounts } = require('../mounts');
const { assertTaskMutationNotStopped } = require('./errors');
const { recordTaskReview } = require('./state');

const REVIEW_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const REVIEW_REQUEST_TIMEOUT_MS = 60_000;

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

function collectReviewOutput(client) {
  const state = { reviewText: '', stderr: '' };
  client.on('stderr', (text) => {
    state.stderr += text;
  });
  client.on('notification', (message) => {
    const item = message.params?.item;
    if (message.method === 'item/completed' && item?.type === 'exitedReviewMode') {
      state.reviewText = item.review || '';
    }
    if (message.method === 'item/completed' && item?.type === 'agentMessage' && item.text) {
      state.reviewText = state.reviewText || item.text;
    }
  });
  return state;
}

async function requestReview({ client, meta, workspaceDir, developerInstructions, target }) {
  await client.initialize();
  await client.request('thread/resume', {
    threadId: meta.threadId,
    cwd: workspaceDir,
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    model: meta.model || undefined,
    developerInstructions,
    persistExtendedHistory: true
  }, { timeoutMs: REVIEW_REQUEST_TIMEOUT_MS });
  const completionPromise = waitForReviewCompletion(client);
  await client.request('review/start', {
    threadId: meta.threadId,
    delivery: 'detached',
    target
  }, { timeoutMs: REVIEW_REQUEST_TIMEOUT_MS });
  await completionPromise;
}

async function runCodexReview(options) {
  const imageReadyController = new AbortController();
  let shutdown = null;
  const unregisterCancel =
    options.orchestrator.registerTaskRunTransitionCancel?.(options.taskId, () => {
      imageReadyController.abort();
      shutdown?.stop('SIGTERM');
    }) ||
    (() => {});
  try {
    await options.orchestrator.ensureCodexImageReady?.({
      imageName: resolveCodexRunImageName(options.orchestrator, options.envOverrides),
      signal: imageReadyController.signal
    });
    const env = buildRunEnv(options);
    const useProcessGroup = process.platform !== 'win32';
    const child = options.orchestrator.spawn('codex-docker', buildCodexAppServerArgs(), {
      cwd: options.meta.worktreePath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: useProcessGroup
    });
    shutdown = createBoundedChildShutdown({
      child,
      useProcessGroup,
      stopTimeoutMs: options.orchestrator.appServerShutdownTimeoutMs
    });
    const client = new AppServerClient({ child, requestTimeoutMs: REVIEW_REQUEST_TIMEOUT_MS });
    const output = collectReviewOutput(client);
    await requestReview({ client, ...options });
    if (!output.reviewText.trim() && output.stderr.trim()) {
      throw new Error(output.stderr.trim());
    }
    return output.reviewText.trim();
  } finally {
    unregisterCancel();
    shutdown?.stop('SIGTERM');
  }
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
    artifactsDir: orchestrator.runArtifactsDir(
      taskId,
      meta.runs?.[meta.runs.length - 1]?.runId || 'run-1'
    )
  };
}

async function buildAutoReviewFixPrompt(review) {
  const template = await fs.readFile(DEFAULT_AUTO_REVIEW_FIX_PROMPT_TEMPLATE_FILE, 'utf8');
  return renderTemplate(template.trimEnd(), { message: review || '' }).trim();
}

async function executeTaskReview(orchestrator, options) {
  assertTaskMutationNotStopped(options.transitionClaim);
  await orchestrator.ensureActiveAuth();
  assertTaskMutationNotStopped(options.transitionClaim);
  const runtime = await prepareReviewRuntime(orchestrator, options.taskId, options.meta);
  const review = await runCodexReview({ orchestrator, ...options, ...runtime });
  assertTaskMutationNotStopped(options.transitionClaim);
  return recordTaskReview(orchestrator, { ...options, review });
}

module.exports = {
  buildAutoReviewFixPrompt,
  executeTaskReview
};
