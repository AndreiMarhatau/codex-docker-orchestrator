/* eslint-disable max-lines */
const { AppServerClient } = require('../app-server-client');

const TURN_COMPLETION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const APP_SERVER_REQUEST_TIMEOUT_MS = 60_000;

function mapItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }
  if (item.type === 'agentMessage') {
    return { ...item, type: 'agent_message' };
  }
  if (item.type === 'exitedReviewMode') {
    return {
      id: item.id,
      type: 'agent_message',
      text: item.review || ''
    };
  }
  return item;
}

function mapNotificationToLogEvent(message) {
  const params = message.params || {};
  switch (message.method) {
    case 'thread/started':
      return {
        type: 'thread.started',
        thread_id: params.thread?.id || params.threadId || null,
        thread: params.thread || null
      };
    case 'turn/started':
      return { type: 'turn.started', turn: params.turn || null };
    case 'turn/completed':
      if (params.turn?.status && params.turn.status !== 'completed') {
        return {
          type: 'turn_failed',
          turn: params.turn,
          error: params.turn.error || null
        };
      }
      return { type: 'turn.completed', turn: params.turn || null };
    case 'item/started':
      return { type: 'item.started', item: mapItem(params.item) };
    case 'item/completed':
      return { type: 'item.completed', item: mapItem(params.item) };
    default:
      return {
        type: message.method || 'app_server.notification',
        params
      };
  }
}

function writeLogEvent(tracker, event) {
  if (!event) {
    return;
  }
  tracker.onStdout(Buffer.from(`${JSON.stringify(event)}\n`));
}

function buildThreadParams({
  appServerConfig,
  workspaceDir,
  developerInstructions,
  model
}) {
  const params = {
    cwd: workspaceDir,
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    serviceName: 'codex-docker-orchestrator',
    persistExtendedHistory: true
  };
  if (model) {
    params.model = model;
  }
  if (developerInstructions) {
    params.developerInstructions = developerInstructions;
  }
  if (appServerConfig?.ephemeral === true) {
    params.ephemeral = true;
  }
  return params;
}

function buildTurnParams({
  threadId,
  prompt,
  workspaceDir,
  model,
  reasoningEffort,
  outputSchema
}) {
  const params = {
    threadId,
    input: [{ type: 'text', text: prompt }],
    cwd: workspaceDir,
    approvalPolicy: 'never',
    sandboxPolicy: { type: 'dangerFullAccess' }
  };
  if (model) {
    params.model = model;
  }
  if (reasoningEffort) {
    params.effort = reasoningEffort;
  }
  if (outputSchema) {
    params.outputSchema = outputSchema;
  }
  return params;
}

function waitForTurnCompletion({ client, turnId, collectNotification, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Codex turn to complete.'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      client.off('notification', handleNotification);
      client.off('close', handleClose);
    };

    const handleNotification = (message) => {
      collectNotification?.(message);
      if (message.method !== 'turn/completed') {
        return;
      }
      const turn = message.params?.turn || null;
      if (turnId && turn?.id && turn.id !== turnId) {
        return;
      }
      cleanup();
      resolve(turn);
    };

    const handleClose = (code, signal) => {
      cleanup();
      const error = new Error(`Codex app-server exited before turn completed (${signal || code}).`);
      error.code = code;
      error.signal = signal;
      reject(error);
    };

    client.on('notification', handleNotification);
    client.on('close', handleClose);
  });
}

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

  const collectNotification = (message) => {
    const logEvent = mapNotificationToLogEvent(message);
    writeLogEvent(tracker, logEvent);
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

  const completionPromise = waitForTurnCompletion({
    client,
    turnId: null,
    timeoutMs: TURN_COMPLETION_TIMEOUT_MS
  });
  try {
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
  } catch (error) {
    completionPromise.catch(() => {});
    throw error;
  }
  const completedTurn = await completionPromise;
  const status = completedTurn?.status || 'completed';
  return {
    code: status === 'completed' ? 0 : 1,
    threadId,
    agentMessages,
    turn: completedTurn
  };
}

module.exports = {
  mapNotificationToLogEvent,
  runAppServerTurn,
  writeLogEvent
};
