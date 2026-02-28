async function buildStateSnapshot(orchestrator) {
  const [envs, tasks, accounts] = await Promise.all([
    orchestrator.listEnvs(),
    orchestrator.listTasks(),
    orchestrator.listAccounts()
  ]);
  return { envs, tasks, accounts };
}

module.exports = {
  buildStateSnapshot
};
