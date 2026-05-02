const { ACTIVE_GOAL_STATUS } = require('./app-server-goal-requests');

function isActiveGoal(goal) {
  return typeof goal?.status === 'string' && goal.status.trim() === ACTIVE_GOAL_STATUS;
}

function createTurnCompletionBuffer(client) {
  const completions = [];
  const signals = [];
  const waiters = [];
  const signalWaiters = [];
  let closedError = null;

  function enqueueSignal(signal) {
    const waiter = signalWaiters.shift();
    if (waiter) {
      waiter.resolve(signal);
      return;
    }
    signals.push(signal);
  }

  function removeStartedSignal(turnId) {
    const startedIndex = signals.findIndex((signal) =>
      signal.type === 'started' && signal.turn?.id && signal.turn.id === turnId
    );
    if (startedIndex >= 0) {
      signals.splice(startedIndex, 1);
    }
  }

  function handleNotification(message) {
    if (message.method === 'thread/goal/updated' || message.method === 'thread/goal/cleared') {
      enqueueSignal({ type: 'goal' });
      return;
    }
    if (message.method === 'turn/started') {
      enqueueSignal({ type: 'started', turn: message.params?.turn || null });
      return;
    }
    if (message.method !== 'turn/completed') {
      return;
    }
    const turn = message.params?.turn || null;
    const waiter = waiters.shift();
    if (waiter) {
      removeStartedSignal(turn?.id);
      waiter.resolve(turn);
      return;
    }
    completions.push(turn);
  }

  function handleClose(code, signal) {
    const error = new Error(`Codex app-server exited before turn completed (${signal || code}).`);
    error.code = code;
    error.signal = signal;
    closedError = error;
    while (waiters.length > 0) {
      waiters.shift().reject(error);
    }
    while (signalWaiters.length > 0) {
      signalWaiters.shift().reject(error);
    }
  }

  client.on('notification', handleNotification);
  client.on('close', handleClose);

  return {
    close() {
      client.off('notification', handleNotification);
      client.off('close', handleClose);
      while (waiters.length > 0) {
        waiters.shift().resolve(null);
      }
      while (signalWaiters.length > 0) {
        signalWaiters.shift().resolve(null);
      }
    },
    waitForGoalOrTurnStart({ afterTurnId, timeoutMs }) {
      const signalIndex = signals.findIndex((signal) =>
        signal.type !== 'started' || !afterTurnId || signal.turn?.id !== afterTurnId
      );
      if (signalIndex >= 0) {
        const [signal] = signals.splice(signalIndex, 1);
        return Promise.resolve(signal);
      }
      if (closedError) {
        return Promise.reject(closedError);
      }
      return waitForSignal({ signalWaiters, timeoutMs });
    },
    takeQueuedCompletion() {
      const turn = completions.length > 0 ? completions.shift() : null;
      removeStartedSignal(turn?.id);
      return turn;
    },
    waitForCompletion(timeoutMs) {
      if (completions.length > 0) {
        const turn = completions.shift();
        removeStartedSignal(turn?.id);
        return Promise.resolve(turn);
      }
      if (closedError) {
        return Promise.reject(closedError);
      }
      return new Promise((resolve, reject) => {
        let timeout = null;
        const waiter = {
          resolve: (turn) => {
            clearTimeout(timeout);
            resolve(turn);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        };
        timeout = setTimeout(() => {
          const waiterIndex = waiters.indexOf(waiter);
          if (waiterIndex >= 0) {
            waiters.splice(waiterIndex, 1);
          }
          reject(new Error('Timed out waiting for Codex turn to complete.'));
        }, timeoutMs);
        waiters.push(waiter);
      });
    }
  };
}

function waitForSignal({ signalWaiters, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let timeout = null;
    const waiter = {
      resolve: (signal) => {
        clearTimeout(timeout);
        resolve(signal);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    };
    timeout = setTimeout(() => {
      const waiterIndex = signalWaiters.indexOf(waiter);
      if (waiterIndex >= 0) {
        signalWaiters.splice(waiterIndex, 1);
      }
      reject(new Error('Timed out waiting for Codex goal continuation to start.'));
    }, timeoutMs);
    signalWaiters.push(waiter);
  });
}

async function waitForGoalAwareCompletion({ turnCompletions, getLatestGoal, timeoutMs }) {
  let completedTurn = drainQueuedCompletions(
    turnCompletions,
    await turnCompletions.waitForCompletion(timeoutMs)
  );
  let shouldContinue = completedTurn?.status === 'completed' && isActiveGoal(getLatestGoal());
  while (shouldContinue) {
    const signal = await turnCompletions.waitForGoalOrTurnStart({
      afterTurnId: completedTurn?.id || null,
      timeoutMs
    });
    if (signal?.type === 'goal') {
      shouldContinue = isActiveGoal(getLatestGoal());
      continue;
    }
    completedTurn = drainQueuedCompletions(
      turnCompletions,
      await turnCompletions.waitForCompletion(timeoutMs)
    );
    shouldContinue = completedTurn?.status === 'completed' && isActiveGoal(getLatestGoal());
  }
  return completedTurn;
}

function drainQueuedCompletions(turnCompletions, completedTurn) {
  let queuedCompletion = turnCompletions.takeQueuedCompletion();
  while (queuedCompletion) {
    completedTurn = queuedCompletion;
    queuedCompletion = turnCompletions.takeQueuedCompletion();
  }
  return completedTurn;
}

module.exports = { createTurnCompletionBuffer, waitForGoalAwareCompletion };
