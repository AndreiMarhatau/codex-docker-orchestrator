import {
  extractText,
  formatLogEntry,
  formatLogSummary,
  getEntryType,
  getItemType,
  isAgentMessageEntry
} from './log-entry-helpers.js';
import { buildReviewTimelineItem, isReviewEntry as isReviewLogEntry } from './review-log-helpers.js';

function collectAgentMessages(entries) {
  if (!entries || entries.length === 0) {
    return [];
  }

  return entries.reduce((messages, entry) => {
    const parsed = entry?.parsed;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      isReviewLogEntry(entry) ||
      !isAgentMessageEntry(entry)
    ) {
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

  if (isReviewLogEntry(entry) || isAgentMessageEntry(entry)) {
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
    const reviewItem = buildReviewTimelineItem(entry);
    if (reviewItem) {
      flushEvents();
      timeline.push(reviewItem);
      return;
    }

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
