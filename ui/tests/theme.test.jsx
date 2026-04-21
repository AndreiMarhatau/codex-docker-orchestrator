import { describe, expect, it } from 'vitest';
import createAppTheme from '../src/theme.js';

describe('theme', () => {
  it('creates light and dark themes', () => {
    const light = createAppTheme('light');
    const dark = createAppTheme('dark');

    expect(light.palette.mode).toBe('light');
    expect(light.palette.primary.main).toBe('#1d6b57');
    expect(dark.palette.mode).toBe('dark');
    expect(dark.palette.background.default).toBe('#0f120f');
    expect(light.shape.borderRadius).toBe(20);
  });
});
