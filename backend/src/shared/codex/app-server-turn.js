const { AppServerClient } = require('./app-server-client');
const { mapNotificationToLogEvent, writeLogEvent } = require('./app-server-events');
const {
  createTurnCompletionBuffer,
  waitForGoalAwareCompletion
} = require('./app-server-goals');
const { applyRequestedGoalState } = require('./app-server-goal-requests');
const { buildThreadParams, buildTurnParams } = require('./app-server-requests');

const TURN_COMPLETION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const APP_SERVER_REQUEST_TIMEOUT_MS = 60_000;

async function startOrResumeThread({ client, appServerConfig, workspaceDir }) {
  const threadParams = buildThreadParams({
    appServerConfig,
    workspaceDir,
    developerInstructions: appServerConfig.developerInstructions,
    model: appServerConfig.model
  });
  if (appServerConfig.resumeThreadId) {
    const result = await client.request(
      'thread/resume',
      {
        ...threadParams,
        threadId: appServerConfig.resumeThreadId
      },
      { timeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS }
    );
    return result.thread;
  }
  const result = await client.request('thread/start', threadParams, {
    timeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS
  });
  return result.thread;
}

async function runAppServerTurn({
  child,
  tracker,
  prompt,
  workspaceDir,
  appServerConfig
}) {
  const client = new AppServerClient({
    child,
    requestTimeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS
  });
  const agentMessages = [];
  let threadId = appServerConfig.resumeThreadId || null;
  let latestGoal = null;
  let goalObserved = false;

  const collectNotification = (message) => {
    const logEvent = mapNotificationToLogEvent(message);
    writeLogEvent(tracker, logEvent);
    if (message.method === 'thread/goal/updated') {
      goalObserved = true;
      latestGoal = message.params?.goal || null;
    }
    if (message.method === 'thread/goal/cleared') {
      goalObserved = true;
      latestGoal = null;
    }
    const item = message.params?.item;
    if (item?.type === 'agentMessage' && item.text) {
      agentMessages.push(item.text);
    }
  };

  client.on('notification', collectNotification);
  client.on('stderr', (text) => tracker.onStderr(Buffer.from(text)));
  client.on('stdoutText', (line) => tracker.onStderr(Buffer.from(`${line}\n`)));

  await client.initialize();
  const thread = await startOrResumeThread({ client, appServerConfig, workspaceDir });
  threadId = thread?.id || threadId;
  if (threadId) {
    writeLogEvent(tracker, { type: 'thread.started', thread_id: threadId, thread });
  }
  const turnCompletions = createTurnCompletionBuffer(client);
  try {
    if (appServerConfig.clearGoal === true) {
      await applyRequestedGoalState({
        client,
        threadId,
        goalObjective: '',
        clearGoal: true
      });
      goalObserved = true;
      latestGoal = null;
    }
    await client.request(
      'turn/start',
      buildTurnParams({
        threadId,
        prompt,
        workspaceDir,
        model: appServerConfig.model,
        reasoningEffort: appServerConfig.reasoningEffort,
        outputSchema: appServerConfig.outputSchema
      }),
      { timeoutMs: APP_SERVER_REQUEST_TIMEOUT_MS }
    );
    const goalResponse = await applyRequestedGoalState({
      client,
      threadId,
      goalObjective: appServerConfig.goalObjective,
      clearGoal: false
    });
    if (goalResponse?.goal && !latestGoal) {
      goalObserved = true;
      latestGoal = goalResponse.goal;
    }
  } catch (error) {
    turnCompletions.close();
    throw error;
  }
  let completedTurn = null;
  try {
    completedTurn = await waitForGoalAwareCompletion({
      turnCompletions,
      getLatestGoal: () => latestGoal,
      timeoutMs: TURN_COMPLETION_TIMEOUT_MS
    });
  } finally {
    turnCompletions.close();
  }
  const status = completedTurn?.status || 'completed';
  return {
    code: status === 'completed' ? 0 : 1,
    threadId,
    goal: latestGoal,
    goalObserved,
    agentMessages,
    turn: completedTurn
  };
}

module.exports = {
  runAppServerTurn
};
