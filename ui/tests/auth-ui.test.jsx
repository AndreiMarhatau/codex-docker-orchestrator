import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AuthGate from '../src/app/components/AuthGate.jsx';
import SettingsTab from '../src/app/tabs/SettingsTab.jsx';

describe('AuthGate', () => {
  it('shows a checking label when verifying access', () => {
    const authState = {
      checking: true,
      error: '',
      login: vi.fn(),
      passwordRequired: true
    };
    render(<AuthGate authState={authState} />);

    expect(screen.getByRole('dialog', { name: 'Checking access...' })).toBeInTheDocument();
  });

  it('blocks empty submissions and shows login errors', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Nope'));
    const authState = {
      checking: false,
      error: '',
      login,
      passwordRequired: true
    };
    const user = userEvent.setup();

    render(<AuthGate authState={authState} />);

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(screen.getByText('Enter a password to continue.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Password'), 'sekret');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });
});

describe('SettingsTab', () => {
  it('sets a password when none exists', async () => {
    const updatePassword = vi.fn().mockResolvedValue();
    const authState = {
      passwordRequired: false,
      updatePassword
    };
    const user = userEvent.setup();

    render(<SettingsTab authState={authState} />);

    await user.click(screen.getByRole('button', { name: 'Set password' }));
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Password'), 'pass-1234');
    await user.type(screen.getByLabelText('Confirm password'), 'pass-1234');
    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(updatePassword).toHaveBeenCalledWith({
      password: 'pass-1234',
      currentPassword: ''
    });
    expect(await screen.findByText('Password set.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveValue(''));
  });

  it('requires matching passwords when changing an existing password', async () => {
    const updatePassword = vi.fn().mockResolvedValue();
    const authState = {
      passwordRequired: true,
      updatePassword
    };
    const user = userEvent.setup();

    render(<SettingsTab authState={authState} />);

    await user.type(screen.getByLabelText('Current password'), 'old-pass');
    await user.type(screen.getByLabelText('New password'), 'new-pass');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalled();
  });
});
