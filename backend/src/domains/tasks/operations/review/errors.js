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

module.exports = {
  assertTaskMutationNotStopped,
  createTaskMutationStoppedError
};
