function getItemType(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }
  return item.type || item.kind || item.role || '';
}

function extractText(value) {
  if (typeof value === 'string') {
    return value.trim() ? value : '';
  }
  if (!value || typeof value !== 'object') {
    return '';
  }
  for (const key of ['text', 'message', 'content', 'value', 'delta']) {
    if (key in value) {
      const text = extractText(value[key]);
      if (text) {
        return text;
      }
    }
  }
  return '';
}

function isReviewEntry(entry) {
  const parsed = entry?.parsed;
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  return getItemType(parsed.item) === 'review';
}

function getReviewLabel(entry) {
  const item = entry?.parsed?.item;
  return item?.automatic === true ? 'Auto review' : 'Review';
}

function buildReviewTimelineItem(entry) {
  if (!isReviewEntry(entry)) {
    return null;
  }
  const text = extractText(entry?.parsed?.item) || extractText(entry?.parsed);
  return text
    ? { type: 'review', entry, text, label: getReviewLabel(entry) }
    : null;
}

export { buildReviewTimelineItem, isReviewEntry };
