const { buildRunEntry } = require('./run-entry');
const { cleanupContextRepos } = require('./cleanup');

function resolveDockerUsage(meta, options) {
  const hasDockerSocketOverride = typeof options.useHostDockerSocket === 'boolean';
  const shouldUseHostDockerSocket = hasDockerSocketOverride
    ? options.useHostDockerSocket
    : Boolean(meta.useHostDockerSocket);
  return { hasDockerSocketOverride, shouldUseHostDockerSocket };
}

function applyResumeMetaUpdates({
  meta,
  prompt,
  hasDockerSocketOverride,
  shouldUseHostDockerSocket,
  now,
  activeAccount,
  runLabel,
  runModel,
  runReasoningEffort
}) {
  const hasPrompt = typeof prompt === 'string' && prompt.length > 0;
  meta.updatedAt = now();
  meta.status = 'running';
  meta.error = null;
  if (hasPrompt) {
    meta.lastPrompt = prompt;
  }
  if (hasDockerSocketOverride) {
    meta.useHostDockerSocket = shouldUseHostDockerSocket;
  }
  meta.runs.push(
    buildRunEntry({
      runLabel,
      prompt,
      model: runModel,
      reasoningEffort: runReasoningEffort,
      now: now(),
      account: activeAccount,
      useHostDockerSocket: shouldUseHostDockerSocket
    })
  );
}

function toContextCleanupEntries(contextRepos) {
  return (contextRepos || []).map((entry) => ({
    envId: entry?.envId,
    worktreePath: entry?.worktreePath
  }));
}

async function restoreContextRepos(orch, taskId, contextRepos) {
  if (!Array.isArray(contextRepos) || contextRepos.length === 0) {
    return [];
  }
  const restorePlan = await orch.prepareContextRepos(taskId, contextRepos);
  await orch.materializeContextRepos(restorePlan);
  return contextRepos;
}

async function replaceContextReposForResume(orch, taskId, currentContextRepos, nextContextRepos) {
  const nextPlan = await orch.prepareContextRepos(taskId, nextContextRepos || []);
  await cleanupContextRepos(orch, currentContextRepos);
  try {
    const resolvedContextRepos = await orch.materializeContextRepos(nextPlan);
    return {
      previousContextRepos: currentContextRepos,
      resolvedContextRepos
    };
  } catch (error) {
    await cleanupContextRepos(orch, toContextCleanupEntries(nextPlan));
    await restoreContextRepos(orch, taskId, currentContextRepos);
    throw error;
  }
}

async function rollbackContextRepoReplacement(orch, taskId, state) {
  await cleanupContextRepos(orch, state.resolvedContextRepos);
  return restoreContextRepos(orch, taskId, state.previousContextRepos);
}

module.exports = {
  applyResumeMetaUpdates,
  resolveDockerUsage,
  replaceContextReposForResume,
  rollbackContextRepoReplacement
};
