import { fireEvent, screen, waitFor, within } from '@testing-library/react';

async function exerciseEnvironmentsTab(user) {
  await user.click(screen.getByRole('tab', { name: 'Environments' }));
  expect(await screen.findByText('Create and manage repo sources for Codex runs.')).toBeInTheDocument();
  expect(screen.getByText('2 environments')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Sync now' }));
  const editButtons = screen.getAllByRole('button', { name: 'Edit' });
  await user.click(editButtons[0]);
  const editDialog = await screen.findByRole('dialog', { name: 'Edit environment' });
  const baseBranchInput = within(editDialog).getByLabelText('Base branch');
  await user.clear(baseBranchInput);
  await user.type(baseBranchInput, 'develop');
  const envVarsInput = within(editDialog).getByLabelText('Selected environment variables');
  await user.clear(envVarsInput);
  await user.type(envVarsInput, 'API_TOKEN=beta\nFEATURE_FLAG=false');
  await user.click(within(editDialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit environment' })).not.toBeInTheDocument()
  );
  expect(await screen.findByText('default: develop')).toBeInTheDocument();
  const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
  await user.click(removeButtons[removeButtons.length - 1]);
}

async function exerciseAccountsTab(user) {
  await user.click(screen.getByRole('tab', { name: 'Accounts' }));
  expect(await screen.findByText('Usage limits')).toBeInTheDocument();
  expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
  expect(screen.getByText('Credits')).toBeInTheDocument();
  const showAuthButtons = screen.getAllByRole('button', { name: 'Show auth.json' });
  await user.click(showAuthButtons[0]);
  const authFields = screen.getAllByLabelText('Stored auth.json');
  expect(authFields[0].value).toContain('"token": "primary"');
  const saveAuthButton = screen.getByRole('button', { name: 'Save' });
  expect(saveAuthButton).toBeDisabled();
  await user.clear(authFields[0]);
  fireEvent.change(authFields[0], { target: { value: '{"token":"primary-updated"}' } });
  expect(saveAuthButton).toBeEnabled();
  await user.click(saveAuthButton);
  await user.click(screen.getByRole('button', { name: 'Check usage limits' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Rotate now' })).toBeEnabled()
  );
  await user.click(screen.getByRole('button', { name: 'Rotate now' }));
  const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
  await user.click(renameButtons[renameButtons.length - 1]);
  await user.clear(screen.getByLabelText('New label'));
  await user.type(screen.getByLabelText('New label'), 'Ops Renamed');
  await user.click(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Ops Renamed')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'New account' }));
  await user.type(screen.getByLabelText('Account label'), 'Ops');
  fireEvent.change(screen.getByLabelText('auth.json contents'), {
    target: { value: '{"token":"x"}' }
  });
  await user.click(screen.getByRole('button', { name: 'Add account' }));
  const activateButtons = screen.getAllByRole('button', { name: 'Make active' });
  await user.click(activateButtons[activateButtons.length - 1]);
  const removeAccountButtons = screen.getAllByRole('button', { name: 'Remove' });
  await user.click(removeAccountButtons[removeAccountButtons.length - 1]);
}

export { exerciseAccountsTab, exerciseEnvironmentsTab };
