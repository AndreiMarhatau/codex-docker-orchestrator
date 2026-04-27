import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mapNotificationToLogEvent } = require('../../src/shared/codex/app-server-events');

describe('app-server runner notification mapping', () => {
  it('maps thread notifications with fallback ids', () => {
    expect(mapNotificationToLogEvent({
      method: 'thread/started',
      params: { threadId: 'thread-fallback' }
    })).toEqual({
      type: 'thread.started',
      thread_id: 'thread-fallback',
      thread: null
    });

    expect(mapNotificationToLogEvent({
      method: 'thread/started',
      params: { thread: { id: 'thread-object' } }
    })).toMatchObject({ thread_id: 'thread-object' });
  });

  it('maps app-server item variants to existing log item shapes', () => {
    expect(mapNotificationToLogEvent({
      method: 'item/completed',
      params: { item: { id: 'item-1', type: 'agentMessage', text: 'Hello' } }
    })).toEqual({
      type: 'item.completed',
      item: { id: 'item-1', type: 'agent_message', text: 'Hello' }
    });

    expect(mapNotificationToLogEvent({
      method: 'item/completed',
      params: { item: { id: 'review-1', type: 'exitedReviewMode', review: 'No findings.' } }
    })).toEqual({
      type: 'item.completed',
      item: { id: 'review-1', type: 'review', phase: 'completed', text: 'No findings.' }
    });

    expect(mapNotificationToLogEvent({
      method: 'item/started',
      params: { item: null }
    })).toEqual({ type: 'item.started', item: null });

    expect(mapNotificationToLogEvent({
      method: 'item/completed',
      params: { item: { id: 'tool-1', type: 'toolCall' } }
    })).toEqual({ type: 'item.completed', item: { id: 'tool-1', type: 'toolCall' } });

    expect(mapNotificationToLogEvent({
      method: 'item/completed',
      params: { item: { id: 'review-2', type: 'exitedReviewMode' } }
    })).toEqual({
      type: 'item.completed',
      item: { id: 'review-2', type: 'review', phase: 'completed', text: '' }
    });
  });

  it('maps completed, failed, and unknown turn notifications', () => {
    expect(mapNotificationToLogEvent({ method: 'turn/started' }))
      .toEqual({ type: 'turn.started', turn: null });
    expect(mapNotificationToLogEvent({
      method: 'turn/completed',
      params: { turn: { id: 'turn-1', status: 'completed' } }
    })).toEqual({ type: 'turn.completed', turn: { id: 'turn-1', status: 'completed' } });

    expect(mapNotificationToLogEvent({
      method: 'turn/completed',
      params: { turn: { id: 'turn-2', status: 'failed', error: { message: 'nope' } } }
    })).toEqual({
      type: 'turn_failed',
      turn: { id: 'turn-2', status: 'failed', error: { message: 'nope' } },
      error: { message: 'nope' }
    });
    expect(mapNotificationToLogEvent({
      method: 'turn/completed',
      params: { turn: { id: 'turn-3', status: 'failed' } }
    })).toEqual({
      type: 'turn_failed',
      turn: { id: 'turn-3', status: 'failed' },
      error: null
    });

    expect(mapNotificationToLogEvent({ method: 'custom/event', params: { ok: true } }))
      .toEqual({ type: 'custom/event', params: { ok: true } });
    expect(mapNotificationToLogEvent({ method: 'turn/completed' }))
      .toEqual({ type: 'turn.completed', turn: null });
    expect(mapNotificationToLogEvent({ method: 'thread/started' }))
      .toEqual({ type: 'thread.started', thread_id: null, thread: null });
    expect(mapNotificationToLogEvent({ params: { ok: false } }))
      .toEqual({ type: 'app_server.notification', params: { ok: false } });
    expect(mapNotificationToLogEvent({}))
      .toEqual({ type: 'app_server.notification', params: {} });
  });
});
