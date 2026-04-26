function buildRunEntry({
  runLabel,
  prompt,
  model,
  reasoningEffort,
  now,
  account,
  useHostDockerSocket,
  autoReviewRemaining = 0
}) {
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
    failedBeforeSpawn: false,
    useHostDockerSocket,
    autoReviewRemaining,
    gitFingerprintBefore: null,
    gitFingerprintAfter: null,
    accountId: account?.id || null,
    accountLabel: account?.label || null
  };
}

module.exports = {
  buildRunEntry
};
