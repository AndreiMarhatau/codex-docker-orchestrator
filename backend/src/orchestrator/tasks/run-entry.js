function buildRunEntry({ runLabel, prompt, model, reasoningEffort, now, account, useHostDockerSocket }) {
  return {
    runId: runLabel,
    prompt,
    model,
    reasoningEffort,
    logFile: `${runLabel}.jsonl`,
    startedAt: now,
    finishedAt: null,
    status: 'running',
    exitCode: null,
    useHostDockerSocket,
    accountId: account?.id || null,
    accountLabel: account?.label || null
  };
}

module.exports = {
  buildRunEntry
};
