import { describe, expect, it } from 'vitest';
import { createMockState } from '../src/mock/mockData.js';

describe('mock data', () => {
  it('embeds self-contained urls for seeded artifacts', () => {
    const artifacts = createMockState().taskDetails['task-4'].runLogs[0].artifacts;

    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'screenshots/desktop-tasks.png',
          url: expect.stringMatching(/^data:image\/svg\+xml/)
        }),
        expect.objectContaining({
          path: 'screenshots/mobile-task-detail.png',
          url: expect.stringMatching(/^data:image\/svg\+xml/)
        }),
        expect.objectContaining({
          path: 'notes/mock-preview.md',
          url: expect.stringMatching(/^data:text\/markdown/)
        })
      ])
    );
  });
});
