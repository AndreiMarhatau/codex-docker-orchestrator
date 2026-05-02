const APP_SERVER_REQUEST_TIMEOUT_MS = 60_000;
const ACTIVE_GOAL_STATUS = 'active';

function normalizeGoalObjective(goalObjective) {
  return typeof goalObjective === 'string' ? goalObjective.trim() : '';
}

async function applyRequestedGoalState({ client, threadId, goalObjective, clearGoal }) {
  const objective = normalizeGoalObjective(goalObjective);
  if (objective) {
    return client.request(
      'thread/goal/set',
      {
        threadId,
        objective,
        status: ACTIVE_GOAL_STATUS
      },
      { timeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS }
    );
  }
  if (clearGoal) {
    return client.request('thread/goal/clear', { threadId }, {
      timeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS
    });
  }
  return null;
}

module.exports = {
  ACTIVE_GOAL_STATUS,
  applyRequestedGoalState
};
