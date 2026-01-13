import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { clearStoredPassword } from '../src/auth-storage.js';

beforeEach(() => {
  global.fetch = vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/settings/password')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ hasPassword: false })
      };
    }
    if (url.includes('/api/settings/auth')) {
      return {
        ok: true,
        status: 204,
        json: async () => ({})
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => []
    };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  clearStoredPassword();
});
