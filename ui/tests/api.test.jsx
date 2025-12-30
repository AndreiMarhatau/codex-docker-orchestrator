import { describe, expect, it } from 'vitest';
import { apiRequest, apiUrl } from '../src/api.js';

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

  it('returns json payloads from apiRequest', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    });

    await expect(apiRequest('/api/test')).resolves.toEqual({ ok: true });
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
});
