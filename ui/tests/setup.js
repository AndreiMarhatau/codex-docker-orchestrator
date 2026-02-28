import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { clearStoredPassword } from '../src/auth-storage.js';

vi.mock('../src/app/hooks/useNow.js', () => ({
  __esModule: true,
  default: () => Date.now()
}));

vi.mock('@mui/material/Tooltip', async () => {
  const React = await vi.importActual('react');
  const Tooltip = ({ children }) => React.createElement(React.Fragment, null, children);
  return {
    __esModule: true,
    default: Tooltip,
    Tooltip
  };
});

vi.mock('@mui/material/ButtonBase', async () => {
  const React = await vi.importActual('react');
  const ButtonBase = ({ component: Component = 'button', children, ...props }) =>
    React.createElement(Component, props, children);
  return {
    __esModule: true,
    default: ButtonBase,
    ButtonBase
  };
});

const originalConsoleError = console.error;

beforeAll(() => {
  console.error = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('not wrapped in act')) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  global.EventSource = class MockEventSource {
    addEventListener() {}
    removeEventListener() {}
    close() {}
  };
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
