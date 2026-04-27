export async function waitForTaskStatus(orchestrator, taskId, status) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const task = await orchestrator.getTask(taskId);
    if (task.status === status) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for status ${status}`);
}

export async function waitForTaskIdle(orchestrator, taskId) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (
      !orchestrator.running?.has(taskId) &&
      !orchestrator.taskRunClaims?.has(taskId) &&
      !orchestrator.finalizingTaskRuns?.has(taskId)
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for task to become idle');
}
