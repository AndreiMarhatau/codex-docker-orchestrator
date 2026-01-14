import { describe, expect, it, vi } from 'vitest';
import { apiRequest, apiUrl, apiUrlWithPassword } from '../src/api.js';
import {
  clearStoredPassword,
  getStoredPassword,
  onAuthRequired,
  setStoredPassword
} from '../src/auth-storage.js';

describe('api helpers', () => {
  it('builds api urls with optional base', () => {
    expect(apiUrl('/api/tasks')).toBe('/api/tasks');
    expect(apiUrl('/api/tasks', 'http://localhost:8080')).toBe(
      'http://localhost:8080/api/tasks'
    );
    expect(apiUrl('/api/tasks', 'http://localhost:8080/')).toBe(
      'http://localhost:8080/api/tasks'
    );
  });

  it('adds stored password to api urls', () => {
    setStoredPassword('sekret');
    expect(apiUrlWithPassword('/api/tasks')).toContain('password=sekret');
    clearStoredPassword();
  });

  it('returns json payloads from apiRequest', async () => {
    setStoredPassword('sekret');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });

    await expect(apiRequest('/api/test')).resolves.toEqual({ ok: true });
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers['X-Orch-Password']).toBe('sekret');
    clearStoredPassword();
  });

  it('returns null for 204 responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({})
    });

    await expect(apiRequest('/api/no-content')).resolves.toBeNull();
  });

  it('throws when requests fail', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Failure'
    });

    await expect(apiRequest('/api/fail')).rejects.toThrow('Failure');
  });

  it('clears stored password on 401 responses', async () => {
    const handler = vi.fn();
    const unsubscribe = onAuthRequired(handler);
    setStoredPassword('sekret');

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    });

    await expect(apiRequest('/api/locked')).rejects.toThrow('Unauthorized');
    expect(getStoredPassword()).toBe('');
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
