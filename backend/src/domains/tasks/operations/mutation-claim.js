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

module.exports = {
  assertTaskMutationNotStopped,
  withTaskMutationClaim
};
