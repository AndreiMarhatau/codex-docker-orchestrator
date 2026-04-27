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

export {
  extractText,
  formatLogEntry,
  formatLogSummary,
  getEntryType,
  getItemType,
  isAgentMessageEntry
};
