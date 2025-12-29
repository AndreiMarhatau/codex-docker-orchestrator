function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch (error) {
    return null;
  }
}

function parseThreadId(jsonl) {
  const lines = jsonl.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const payload = safeJsonParse(line);
    if (payload?.type === 'thread.started' && payload.thread_id) {
      return payload.thread_id;
    }
  }
  return null;
}

function parseLogEntries(content) {
  if (!content) {
    return [];
  }
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    const parsed = safeJsonParse(line);
    return {
      id: `log-${index + 1}`,
      type: parsed?.type || 'text',
      raw: line,
      parsed
    };
  });
}

function isUsageLimitError(output) {
  if (!output) {
    return false;
  }
  const lines = output.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const payload = safeJsonParse(line);
    if (!payload || typeof payload !== 'object') {
      continue;
    }
    let message = null;
    if (payload.type === 'error' && typeof payload.message === 'string') {
      message = payload.message;
    } else if (
      payload.type === 'turn_failed' &&
      payload.error &&
      typeof payload.error.message === 'string'
    ) {
      message = payload.error.message;
    }
    if (!message) {
      continue;
    }
    const lower = message.toLowerCase();
    if (lower.includes("you've hit your usage limit")) {
      return true;
    }
    if (lower.includes('usage limit') && lower.includes('codex')) {
      return true;
    }
    if (lower.includes('usage limit') && lower.includes('chatgpt')) {
      return true;
    }
    if (lower.includes('usage limit')) {
      return true;
    }
  }
  return false;
}

module.exports = {
  parseThreadId,
  parseLogEntries,
  isUsageLimitError,
  safeJsonParse
};
