import { render as rtlRender } from '@testing-library/react';
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
    setMatchMedia(false);
    document.body.innerHTML = '<div id="root"></div>';
    await import('../src/main.jsx');
    expect(render).toHaveBeenCalled();
  });

  it('handles dark theme preference', async () => {
    render.mockClear();
    setMatchMedia(true);
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    await import('../src/main.jsx');
    expect(render).toHaveBeenCalled();
  });
});
