function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function createTurnEmitter(context) {
  return ({ turnId, item, message }) => {
    setImmediate(async () => {
      context.write({
        method: 'turn/started',
        params: { turn: { id: turnId, status: 'inProgress', items: [] } }
      });
      if (context.onBeforeTurnComplete) {
        await context.onBeforeTurnComplete({ ...context.eventContext, message, turnId });
      }
      if (context.turnCompletionDelayMs > 0) {
        await delay(context.turnCompletionDelayMs);
      }
      context.write({ method: 'item/completed', params: { item } });
      context.write({
        method: 'turn/completed',
        params: { turn: { id: turnId, status: 'completed', items: [item] } }
      });
    });
  };
}

function handleThreadStart(context, message) {
  if (message.params?.ephemeral) {
    context.lastThreadId = `thread-ephemeral-${Date.now()}`;
  }
  const thread = { id: context.lastThreadId, status: 'loaded', turns: [] };
  context.write({
    id: message.id,
    result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' }
  });
  context.write({ method: 'thread/started', params: { thread } });
}

function handleThreadResume(context, message) {
  context.lastThreadId = message.params?.threadId || context.lastThreadId;
  const thread = { id: context.lastThreadId, status: 'loaded', turns: [] };
  context.write({
    id: message.id,
    result: { thread, model: 'mock', modelProvider: 'mock', cwd: message.params?.cwd || '/workspace/repo' }
  });
  context.write({ method: 'thread/started', params: { thread } });
}

function responseTextForTurn(context, message) {
  const text = message.params?.input?.[0]?.text || '';
  if (text.includes('commit message')) {
    return JSON.stringify({ message: 'Update mock task' });
  }
  if (message.params?.outputSchema && text.includes('branch name')) {
    return JSON.stringify({ branchName: 'codex/mock-branch' });
  }
  return context.defaultAgentMessageText;
}

function handleTurnStart(context, message) {
  context.turnCount += 1;
  const turnId = `turn-${context.turnCount}`;
  const item = {
    id: `item-${context.turnCount}`,
    type: 'agentMessage',
    text: responseTextForTurn(context, message)
  };
  context.write({
    id: message.id,
    result: { turn: { id: turnId, status: 'inProgress', items: [], error: null } }
  });
  context.emitTurn({ turnId, item, message });
}

function handleReviewStart(context, message) {
  context.turnCount += 1;
  const turnId = `turn-${context.turnCount}`;
  const review = Array.isArray(context.reviewTexts)
    ? context.reviewTexts[Math.min(context.reviewCount, context.reviewTexts.length - 1)]
    : 'No findings.';
  context.reviewCount += 1;
  const item = { id: `review-${context.turnCount}`, type: 'exitedReviewMode', review };
  context.write({
    id: message.id,
    result: {
      turn: { id: turnId, status: 'inProgress', items: [], error: null },
      reviewThreadId: `review-${context.lastThreadId}`
    }
  });
  context.emitTurn({ turnId, item, message });
}

function handleAppServerMessage(context, message) {
  if (message && context.call) {
    context.call.messages.push(message);
  }
  if (message?.method === 'initialize' && message.id !== undefined) {
    context.write({ id: message.id, result: { userAgent: 'codex-mock' } });
  } else if (message?.method === 'account/rateLimits/read' && message.id !== undefined) {
    context.write({ id: message.id, result: { rateLimits: context.rateLimits } });
    context.child.stdout.end();
    context.child.emit('close', 0, null);
  } else if (message?.method === 'thread/start' && message.id !== undefined) {
    handleThreadStart(context, message);
  } else if (message?.method === 'thread/resume' && message.id !== undefined) {
    handleThreadResume(context, message);
  } else if (message?.method === 'turn/start' && message.id !== undefined) {
    handleTurnStart(context, message);
  } else if (message?.method === 'review/start' && message.id !== undefined) {
    handleReviewStart(context, message);
  }
}

function attachLineReader(child, handleMessage) {
  let buffer = '';
  child.stdin.on('data', (chunk) => {
    buffer += chunk.toString();
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        handleMessage(parseJsonLine(line));
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });
}

export function createAppServerResponder(config) {
  let reviewCount = 0;
  return (child, call = null, options = {}) => {
    const context = {
      ...config,
      child,
      call,
      reviewCount,
      turnCount: 0,
      lastThreadId: '019b341f-04d9-73b3-8263-2c05ca63d690',
      eventContext: { child, call, options },
      write: (payload) => child.stdout.write(`${JSON.stringify(payload)}\n`)
    };
    context.emitTurn = createTurnEmitter(context);
    attachLineReader(child, (message) => {
      handleAppServerMessage(context, message);
      reviewCount = context.reviewCount;
    });
  };
}
