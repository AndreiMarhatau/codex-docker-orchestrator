function formatLogEntry(entry) {
  if (!entry) {
    return '';
  }
  if (entry.parsed) {
    try {
      return JSON.stringify(entry.parsed, null, 2);
    } catch (error) {
      return entry.raw || '';
    }
  }
  return entry.raw || '';
}

function formatLogSummary(entry) {
  if (!entry) {
    return '';
  }
  const summary = entry.type || '';
  if (
    (entry.type === 'item.started' || entry.type === 'item.completed') &&
    entry.parsed?.item?.type
  ) {
    return `${summary} \u2022 ${entry.parsed.item.type}`;
  }
  return summary;
}

function collectAgentMessages(entries) {
  if (!entries || entries.length === 0) {
    return [];
  }
  return entries
    .filter(
      (entry) =>
        entry.parsed?.type === 'item.completed' &&
        entry.parsed?.item?.type === 'agent_message' &&
        entry.parsed?.item?.text
    )
    .map((entry) => entry.parsed.item.text);
}

export { collectAgentMessages, formatLogEntry, formatLogSummary };
