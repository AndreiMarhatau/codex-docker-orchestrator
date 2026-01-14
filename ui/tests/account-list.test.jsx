import { fireEvent, render, screen } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AccountList from '../src/app/tabs/accounts/AccountList.jsx';

describe('AccountList', () => {
  it('preserves auth draft when toggling auth.json visibility', async () => {
    const user = userEvent.setup();
    const accountsState = {
      handleActivateAccount: vi.fn(),
      handleDeleteAccount: vi.fn(),
      handleRenameAccount: vi.fn(),
      handleUpdateAuthJson: vi.fn()
    };
    const data = {
      loading: false,
      accountState: {
        activeAccountId: 'acct-1',
        accounts: [
          {
            id: 'acct-1',
            label: 'Primary',
            authJson: '{"token":"primary"}',
            position: 1,
            isActive: true,
            createdAt: '2024-01-01T10:00:00Z'
          }
        ]
      }
    };

    render(<AccountList accountsState={accountsState} data={data} />);

    await user.click(screen.getByRole('button', { name: 'Show auth.json' }));
    const authField = screen.getByLabelText('Stored auth.json');
    await user.clear(authField);
    fireEvent.change(authField, { target: { value: '{"token":"draft"}' } });
    await user.click(screen.getByRole('button', { name: 'Hide auth.json' }));
    await user.click(screen.getByRole('button', { name: 'Show auth.json' }));

    expect(screen.getByLabelText('Stored auth.json')).toHaveValue('{"token":"draft"}');
  });
});
