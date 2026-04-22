import { describe, expect, it } from 'vitest';
import createAppTheme from '../src/theme.js';

describe('theme', () => {
  it('creates light and dark themes', () => {
    const light = createAppTheme('light');
    const dark = createAppTheme('dark');

    expect(light.palette.mode).toBe('light');
    expect(light.palette.primary.main).toBe('#2563eb');
    expect(dark.palette.mode).toBe('dark');
    expect(dark.palette.background.default).toBe('#0d131c');
    expect(light.shape.borderRadius).toBe(12);
  });
});
