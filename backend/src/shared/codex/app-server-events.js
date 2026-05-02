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
      type: 'review',
      phase: 'completed',
      text: item.review || ''
    };
  }
  return item;
}

function mapTurnCompletion(params) {
  if (params.turn?.status && params.turn.status !== 'completed') {
    return {
      type: 'turn_failed',
      turn: params.turn,
      error: params.turn.error || null
    };
  }
  return { type: 'turn.completed', turn: params.turn || null };
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
    case 'thread/goal/updated':
      return {
        type: 'thread.goal.updated',
        thread_id: params.threadId || params.goal?.threadId || null,
        turn_id: params.turnId || null,
        goal: params.goal || null
      };
    case 'thread/goal/cleared':
      return {
        type: 'thread.goal.cleared',
        thread_id: params.threadId || null
      };
    case 'turn/started':
      return { type: 'turn.started', turn: params.turn || null };
    case 'turn/completed':
      return mapTurnCompletion(params);
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
  if (event) {
    tracker.onStdout(Buffer.from(`${JSON.stringify(event)}\n`));
  }
}

module.exports = {
  mapNotificationToLogEvent,
  writeLogEvent
};
