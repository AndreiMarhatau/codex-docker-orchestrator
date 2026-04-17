import { render as rtlRender, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const render = vi.fn((element) => {
  rtlRender(element);
});

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: () => ({
      render
    })
  }
}));

describe('main entry', () => {
  const setMatchMedia = (matches) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  };

  it('boots the react root', async () => {
    render.mockClear();
    vi.unstubAllEnvs();
    vi.resetModules();
    setMatchMedia(false);
    document.body.innerHTML = '<div id="root"></div>';
    await import('../src/main.jsx');
    await waitFor(() => expect(render).toHaveBeenCalled());
  });

  it('does not import the mock API when mock mode is disabled', async () => {
    render.mockClear();
    vi.unstubAllEnvs();
    vi.resetModules();
    const installMockApi = vi.fn();
    const mockApiFactory = vi.fn(() => ({
      installMockApi
    }));
    vi.doMock('../src/mock/mockApi.js', mockApiFactory);
    setMatchMedia(false);
    document.body.innerHTML = '<div id="root"></div>';

    await import('../src/main.jsx');

    expect(mockApiFactory).not.toHaveBeenCalled();
    expect(installMockApi).not.toHaveBeenCalled();
    await waitFor(() => expect(render).toHaveBeenCalled());
    vi.doUnmock('../src/mock/mockApi.js');
  });

  it('handles dark theme preference', async () => {
    render.mockClear();
    vi.unstubAllEnvs();
    vi.resetModules();
    setMatchMedia(true);
    document.body.innerHTML = '<div id="root"></div>';
    await import('../src/main.jsx');
    await waitFor(() => expect(render).toHaveBeenCalled());
  });

  it('installs the mock API when mock mode is enabled', async () => {
    render.mockClear();
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_MOCK_DATA', '1');
    const installMockApi = vi.fn();
    const mockApiFactory = vi.fn(() => ({
      installMockApi
    }));
    vi.doMock('../src/mock/mockApi.js', mockApiFactory);
    setMatchMedia(false);
    document.body.innerHTML = '<div id="root"></div>';

    await import('../src/main.jsx');

    await waitFor(() => expect(mockApiFactory).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(installMockApi).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(render).toHaveBeenCalled());
    vi.doUnmock('../src/mock/mockApi.js');
    vi.unstubAllEnvs();
  });
});
