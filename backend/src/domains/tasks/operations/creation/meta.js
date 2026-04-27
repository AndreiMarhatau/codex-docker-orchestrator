const { readJson, writeJson } = require('../../../../shared/filesystem/storage');
const { fallbackBranchName } = require('../branch-name');
const { buildRunEntry } = require('../run-entry');

function buildTaskMeta(options) {
  return {
    taskId: options.taskId,
    envId: options.envId,
    repoUrl: options.env.repoUrl,
    ref: options.targetRef,
    baseSha: options.baseSha,
    branchName: options.branchName,
    worktreePath: options.worktreePath,
    contextRepos: options.contextRepos,
    attachments: options.attachments,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    useHostDockerSocket: options.useHostDockerSocket,
    autoReview: Boolean(options.autoReview),
    threadId: null,
    error: null,
    status: 'running',
    initialPrompt: options.prompt,
    lastPrompt: options.prompt,
    createdAt: options.now,
    updatedAt: options.now,
    runs: [buildRunEntry({
      runLabel: options.runLabel,
      prompt: options.prompt,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      now: options.now,
      account: options.account,
      useHostDockerSocket: options.useHostDockerSocket
    })]
  };
}

async function persistInitialTaskMeta(orch, options) {
  const now = orch.now();
  const activeAccount = await orch.accountStore.getActiveAccount();
  const meta = buildTaskMeta({
    ...options,
    branchName: fallbackBranchName(options.taskId),
    contextRepos: options.resolvedContextRepos,
    attachments: [],
    useHostDockerSocket: options.shouldUseHostDockerSocket,
    autoReview: Boolean(options.autoReview),
    now,
    account: activeAccount
  });
  orch.markTaskRunTransitionRuntimeActive(options.transitionClaim);
  await writeJson(orch.taskMetaPath(options.taskId), meta);
  return meta;
}

async function writeStartupPreparedMeta(orch, taskId, meta, claim) {
  if (claim?.stopRequested) {
    return orch.stopPersistedTaskRun(taskId, meta);
  }
  const latest = await readJson(orch.taskMetaPath(taskId));
  if (claim?.stopRequested || latest.status === 'stopped') {
    return orch.stopPersistedTaskRun(taskId, latest);
  }
  const nextMeta = {
    ...latest,
    branchName: meta.branchName,
    attachments: meta.attachments,
    updatedAt: meta.updatedAt
  };
  await writeJson(orch.taskMetaPath(taskId), nextMeta);
  if (claim?.stopRequested) {
    return orch.stopPersistedTaskRun(taskId, nextMeta);
  }
  return nextMeta;
}

async function stopCreatedTaskAfterStartupError(orch, taskId, error, claim) {
  if (!claim?.stopRequested && error?.stopped !== true) {
    return null;
  }
  try {
    const meta = await readJson(orch.taskMetaPath(taskId));
    return orch.stopPersistedTaskRun(taskId, meta);
  } catch (readError) {
    return null;
  }
}

module.exports = {
  persistInitialTaskMeta,
  stopCreatedTaskAfterStartupError,
  writeStartupPreparedMeta
};
