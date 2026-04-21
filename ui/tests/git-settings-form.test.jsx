import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { render, screen, waitFor } from './test-utils.jsx';
import GitSettingsForm from '../src/app/tabs/settings/GitSettingsForm.jsx';

describe('GitSettingsForm', () => {
  it('saves a git token and refreshes setup state', async () => {
    const user = userEvent.setup();
    const refreshAll = vi.fn().mockResolvedValue(undefined);

    render(
      <GitSettingsForm
        refreshAll={refreshAll}
        setupState={{
          gitTokenConfigured: false,
          gitUserName: 'Codex Agent',
          gitUserEmail: 'codex@openai.com'
        }}
      />
    );

    await user.type(screen.getByLabelText('GitHub token'), 'ghp_123');
    await user.click(screen.getByRole('button', { name: 'Save token' }));

    await waitFor(() => expect(refreshAll).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/settings/git',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'ghp_123' })
      })
    );
    expect(screen.getByText('Git token saved.')).toBeInTheDocument();
  });

  it('clears an existing git token', async () => {
    const user = userEvent.setup();
    const refreshAll = vi.fn().mockResolvedValue(undefined);

    render(
      <GitSettingsForm
        refreshAll={refreshAll}
        setupState={{
          gitTokenConfigured: true,
          gitUserName: 'Codex Agent',
          gitUserEmail: 'codex@openai.com'
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear token' }));

    await waitFor(() => expect(refreshAll).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/settings/git',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: '' })
      })
    );
    expect(screen.getByText('Git token cleared.')).toBeInTheDocument();
  });

  it('shows submit errors', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Failed to save git token.'
    });

    render(
      <GitSettingsForm
        refreshAll={vi.fn()}
        setupState={{
          gitTokenConfigured: false,
          gitUserName: 'Codex Agent',
          gitUserEmail: 'codex@openai.com'
        }}
      />
    );

    await user.type(screen.getByLabelText('GitHub token'), 'broken');
    await user.click(screen.getByRole('button', { name: 'Save token' }));

    expect(await screen.findByText('Failed to save git token.')).toBeInTheDocument();
  });
});
