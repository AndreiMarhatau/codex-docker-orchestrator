import { describe, expect, it, vi } from 'vitest';
import {
  clearStoredPassword,
  emitAuthRequired,
  getStoredPassword,
  onAuthRequired,
  setStoredPassword
} from '../src/auth-storage.js';

describe('auth storage helpers', () => {
  it('stores and clears password in localStorage', () => {
    setStoredPassword('secret');
    expect(getStoredPassword()).toBe('secret');
    clearStoredPassword();
    expect(getStoredPassword()).toBe('');
  });

  it('emits auth required events', () => {
    const handler = vi.fn();
    const unsubscribe = onAuthRequired(handler);
    emitAuthRequired();
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('handles missing window safely', () => {
    const originalWindow = global.window;
    const originalDocument = global.document;
    // Simulate non-browser environment.
    delete global.window;
    delete global.document;

    expect(getStoredPassword()).toBe('');
    expect(() => setStoredPassword('secret')).not.toThrow();
    expect(() => clearStoredPassword()).not.toThrow();
    expect(() => emitAuthRequired()).not.toThrow();
    expect(() => onAuthRequired(() => {})).not.toThrow();

    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('handles localStorage failures safely', () => {
    const originalStorage = window.localStorage;
    const failingStorage = {
      getItem: () => {
        throw new Error('nope');
      },
      setItem: () => {
        throw new Error('nope');
      },
      removeItem: () => {
        throw new Error('nope');
      }
    };

    Object.defineProperty(window, 'localStorage', {
      value: failingStorage,
      configurable: true
    });

    expect(getStoredPassword()).toBe('');
    expect(() => setStoredPassword('secret')).not.toThrow();
    expect(() => clearStoredPassword()).not.toThrow();

    Object.defineProperty(window, 'localStorage', {
      value: originalStorage,
      configurable: true
    });
  });
});
