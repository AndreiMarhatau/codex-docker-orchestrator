function toLowerString(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function getEntryType(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const entryType = typeof entry.type === 'string' ? entry.type.trim() : '';
  const parsedType = typeof entry.parsed?.type === 'string' ? entry.parsed.type.trim() : '';
  return entryType || parsedType || '';
}

function getItemType(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }
  const itemType = typeof item.type === 'string' ? item.type.trim() : '';
  const itemKind = typeof item.kind === 'string' ? item.kind.trim() : '';
  const itemRole = typeof item.role === 'string' ? item.role.trim() : '';
  return itemType || itemKind || itemRole || '';
}

function extractText(value) {
  if (typeof value === 'string') {
    return value.trim() ? value : '';
  }
  if (Array.isArray(value)) {
    const parts = value.map(extractText).filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : '';
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const candidateKeys = ['text', 'message', 'content', 'value', 'delta'];
  for (const key of candidateKeys) {
    if (key in value) {
      const text = extractText(value[key]);
      if (text) {
        return text;
      }
    }
  }

  return '';
}

function formatLogEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return typeof entry === 'string' ? entry : '';
  }
  const parsed = entry.parsed;
  if (parsed && typeof parsed === 'object') {
    try {
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return entry.raw || '';
    }
  }
  if (typeof parsed === 'string') {
    return parsed;
  }
  if (parsed !== null && parsed !== undefined) {
    return String(parsed);
  }
  if (typeof entry.raw === 'string') {
    return entry.raw;
  }
  if (entry.raw !== null && entry.raw !== undefined) {
    return String(entry.raw);
  }
  return '';
}

function formatLogSummary(entry) {
  const type = getEntryType(entry);
  if (!type) {
    return '';
  }

  const itemType = getItemType(entry.parsed?.item);
  if (itemType) {
    return `${type} • ${itemType}`;
  }

  return type;
}

function isAgentMessageEntry(entry) {
  const parsed = entry?.parsed;
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  const item = parsed.item;
  const itemType = toLowerString(getItemType(item));
  const itemRole = toLowerString(item?.role);
  const parsedType = toLowerString(parsed.type);

  const looksLikeMessage =
    itemRole === 'assistant' ||
    itemRole === 'agent' ||
    itemRole === 'model' ||
    itemType === 'agentmessage' ||
    itemType === 'agent_message' ||
    itemType === 'assistant_message' ||
    itemType === 'agent' ||
    itemType === 'assistant';

  const isToolLike = itemType.includes('tool') || parsedType.includes('tool');
  return looksLikeMessage && !isToolLike;
}

function collectAgentMessages(entries) {
  if (!entries || entries.length === 0) {
    return [];
  }

  return entries.reduce((messages, entry) => {
    const parsed = entry?.parsed;
    if (!parsed || typeof parsed !== 'object') {
      return messages;
    }

    if (!isAgentMessageEntry(entry)) {
      return messages;
    }

    const item = parsed.item;
    const text = extractText(item) || extractText(parsed);
    if (text) {
      messages.push(text);
    }

    return messages;
  }, []);
}

function summarizeEntry(entry) {
  const parsed = entry?.parsed;
  const item = parsed?.item;
  const itemType = getItemType(item);
  const type = getEntryType(entry);
  const text = extractText(item) || extractText(parsed);

  if (isAgentMessageEntry(entry)) {
    return null;
  }

  if (itemType === 'tool_call') {
    return {
      label: 'Tool call',
      detail: text || formatLogSummary(entry)
    };
  }

  if (itemType === 'exec_command') {
    return {
      label: 'Command',
      detail: text || formatLogSummary(entry)
    };
  }

  if (itemType) {
    return {
      label: itemType.replace(/_/g, ' '),
      detail: text || formatLogSummary(entry)
    };
  }

  return {
    label: type || 'event',
    detail: text || formatLogSummary(entry) || formatLogEntry(entry)
  };
}

function buildTimeline(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const timeline = [];
  let pendingEvents = [];

  const flushEvents = () => {
    if (pendingEvents.length === 0) {
      return;
    }
    const summaries = pendingEvents
      .map((entry) => ({ entry, summary: summarizeEntry(entry) }))
      .filter((item) => item.summary);
    if (summaries.length > 0) {
      timeline.push({
        type: 'events',
        entries: summaries.map((item) => item.entry),
        summaries: summaries.map((item) => item.summary)
      });
    }
    pendingEvents = [];
  };

  entries.forEach((entry) => {
    if (isAgentMessageEntry(entry)) {
      flushEvents();
      const parsed = entry?.parsed;
      const text = extractText(parsed?.item) || extractText(parsed);
      if (text) {
        timeline.push({
          type: 'message',
          entry,
          text
        });
      }
      return;
    }
    pendingEvents.push(entry);
  });

  flushEvents();
  return timeline;
}

export { buildTimeline, collectAgentMessages, formatLogEntry, formatLogSummary, summarizeEntry };
