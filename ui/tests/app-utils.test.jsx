import { describe, expect, it, vi } from 'vitest';
import {
  MODEL_CUSTOM_VALUE,
  collectAgentMessages,
  encodeArtifactPath,
  formatAccountLabel,
  formatBytes,
  formatDuration,
  formatDurationFromMinutes,
  formatEpochSeconds,
  formatLogEntry,
  formatLogSummary,
  formatPercent,
  formatRelativeTimeFromEpochSeconds,
  formatRepoDisplay,
  formatTimestamp,
  getEffortOptionsForModel,
  getElapsedMs,
  getGitStatusDisplay,
  getLatestRun,
  isImageArtifact,
  isSupportedTaskImage,
  normalizeAccountState,
  resolveModelValue,
  resolveReasoningEffortValue
} from '../src/App.jsx';

describe('app helpers', () => {
  it('formats timestamps and durations', () => {
    expect(formatTimestamp()).toBe('unknown');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp('2024-01-01T00:00:00Z')).toBe(
      new Date('2024-01-01T00:00:00Z').toLocaleString()
    );
    expect(formatEpochSeconds()).toBe('unknown');
    expect(formatEpochSeconds(1704067200)).toBe(
      new Date('2024-01-01T00:00:00Z').toLocaleString()
    );
    expect(formatDurationFromMinutes(120)).toBe('2 hr');
    expect(formatDurationFromMinutes(60 * 24)).toBe('1 day');
    expect(formatDurationFromMinutes(60 * 24 * 7)).toBe('1 wk');
    expect(formatPercent(12.345)).toBe('12.3%');
    expect(formatPercent(Number.NaN)).toBe('unknown');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(3661000)).toBe('1:01:01');
  });

  it('formats relative time from epoch seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(formatRelativeTimeFromEpochSeconds(nowSeconds)).toBe('now');
    expect(formatRelativeTimeFromEpochSeconds(nowSeconds + 3600)).not.toBe('unknown');
    vi.useRealTimers();
  });

  it('handles model and effort selections', () => {
    expect(getEffortOptionsForModel('gpt-5.2')).toEqual(['none', 'low', 'medium', 'high', 'xhigh']);
    expect(getEffortOptionsForModel('unknown')).toEqual([]);
    expect(resolveModelValue(MODEL_CUSTOM_VALUE, '  custom-model ')).toBe('custom-model');
    expect(resolveModelValue('', 'ignored')).toBe('');
    expect(
      resolveReasoningEffortValue({
        modelChoice: MODEL_CUSTOM_VALUE,
        reasoningEffort: 'low',
        customReasoningEffort: '  xhigh '
      })
    ).toBe('xhigh');
    expect(
      resolveReasoningEffortValue({
        modelChoice: '',
        reasoningEffort: 'high',
        customReasoningEffort: ''
      })
    ).toBe('');
  });

  it('formats repo and account labels', () => {
    expect(formatRepoDisplay('https://github.com/openai/codex.git')).toBe('openai/codex');
    expect(formatRepoDisplay('git@github.com:openai/codex.git')).toBe('openai/codex');
    expect(formatRepoDisplay('')).toBe('');
    expect(formatAccountLabel({ label: 'Primary' })).toBe('Primary');
    expect(formatAccountLabel({ id: 'acct' })).toBe('acct');
    expect(formatAccountLabel()).toBe('unknown');
  });

  it('normalizes account state', () => {
    expect(normalizeAccountState()).toEqual({ accounts: [], activeAccountId: null });
    expect(normalizeAccountState({ accounts: 'bad' })).toEqual({
      accounts: [],
      activeAccountId: null
    });
    const state = { accounts: [], activeAccountId: 'acct' };
    expect(normalizeAccountState(state)).toBe(state);
  });

  it('handles files, logs, and artifacts', () => {
    expect(isSupportedTaskImage({ type: 'image/png', name: 'ok.png' })).toBe(true);
    expect(isSupportedTaskImage({ type: '', name: 'photo.jpeg' })).toBe(true);
    expect(isSupportedTaskImage({ type: 'text/plain', name: 'nope.txt' })).toBe(false);
    expect(getElapsedMs('2024-01-01T00:00:00Z', '2024-01-01T00:00:10Z', 0)).toBe(10000);
    expect(getElapsedMs('2024-01-01T00:00:00Z', 'invalid', 0)).toBeNull();
    expect(getElapsedMs('bad-date', null, 0)).toBeNull();
    expect(getLatestRun({ runs: [{ runId: 1 }, { runId: 2 }] })).toEqual({ runId: 2 });
    expect(getLatestRun({ runs: [] })).toBeNull();
    const circular = {};
    circular.self = circular;
    expect(formatLogEntry({ parsed: circular, raw: 'fallback' })).toBe('fallback');
    expect(formatLogEntry({ parsed: { hello: 'world' } })).toContain('"hello": "world"');
    expect(formatLogEntry({ raw: 'raw log' })).toBe('raw log');
    expect(
      formatLogSummary({
        type: 'item.completed',
        parsed: { item: { type: 'tool_call' } }
      })
    ).toBe('item.completed • tool_call');
    expect(formatLogSummary({ type: 'system.message' })).toBe('system.message');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(null)).toBe('unknown size');
    expect(encodeArtifactPath('logs/run 1/output.txt')).toBe('logs/run%201/output.txt');
    expect(isImageArtifact('image.PNG')).toBe(true);
    expect(isImageArtifact('notes.txt')).toBe(false);
    expect(
      collectAgentMessages([
        {
          parsed: {
            type: 'item.completed',
            item: { type: 'agent_message', text: 'hello' }
          }
        },
        { parsed: { type: 'item.completed', item: { type: 'tool_call', text: 'skip' } } }
      ])
    ).toBe('hello');
    expect(collectAgentMessages([])).toBe('');
  });

  it('renders git status display', () => {
    expect(getGitStatusDisplay()).toBeNull();
    expect(getGitStatusDisplay({ hasChanges: false, dirty: false }).label).toBe('No changes');
    expect(getGitStatusDisplay({ pushed: true, dirty: true }).label).toBe('Changes pushed');
    expect(getGitStatusDisplay({ pushed: false, dirty: false }).label).toBe('Unpushed changes');
    expect(getGitStatusDisplay({ dirty: false }).label).toBe('Git status unknown');
  });
});
