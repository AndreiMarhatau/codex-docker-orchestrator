import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import AccountCard from './AccountCard.jsx';

function AccountList({ accountsState, data }) {
  const { accountState, loading } = data;
  const [authExpanded, setAuthExpanded] = useState({});
  const [authDrafts, setAuthDrafts] = useState({});
  const [renameExpanded, setRenameExpanded] = useState({});
  const [labelDrafts, setLabelDrafts] = useState({});

  const toggleAuth = (account) => {
    setAuthExpanded((prev) => ({ ...prev, [account.id]: !prev[account.id] }));
    setAuthDrafts((prev) => {
      if (prev[account.id] !== undefined) {
        return prev;
      }
      return { ...prev, [account.id]: account.authJson ?? '' };
    });
  };

  const toggleRename = (account) => {
    setRenameExpanded((prev) => ({ ...prev, [account.id]: !prev[account.id] }));
    setLabelDrafts((prev) => ({
      ...prev,
      [account.id]: prev[account.id] ?? account.label ?? ''
    }));
  };

  const handleRenameChange = (accountId, value) => {
    setLabelDrafts((prev) => ({ ...prev, [accountId]: value }));
  };

  const handleRenameSave = async (accountId) => {
    await accountsState.handleRenameAccount(accountId, labelDrafts[accountId] ?? '');
    setRenameExpanded((prev) => ({ ...prev, [accountId]: false }));
  };

  const handleAuthChange = (accountId, value) => {
    setAuthDrafts((prev) => ({ ...prev, [accountId]: value }));
  };

  const handleAuthSave = async (accountId) => {
    const draft = authDrafts[accountId] ?? '';
    const payload = await accountsState.handleUpdateAuthJson(accountId, draft);
    const updated = payload?.accounts?.find((item) => item.id === accountId);
    if (updated) {
      setAuthDrafts((prev) => ({ ...prev, [accountId]: updated.authJson ?? '' }));
    }
  };

  return (
    <>
      <Stack spacing={1.5}>
        {accountState.accounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            accountsState={accountsState}
            authDraft={authDrafts[account.id] ?? account.authJson ?? ''}
            authExpanded={Boolean(authExpanded[account.id])}
            labelDraft={labelDrafts[account.id] ?? account.label ?? ''}
            loading={loading}
            renameExpanded={Boolean(renameExpanded[account.id])}
            onAuthChange={(value) => handleAuthChange(account.id, value)}
            onAuthSave={() => handleAuthSave(account.id)}
            onToggleAuth={() => toggleAuth(account)}
            onToggleRename={() => toggleRename(account)}
            onRenameChange={(value) => handleRenameChange(account.id, value)}
            onRenameSave={() => handleRenameSave(account.id)}
          />
        ))}
        {accountState.accounts.length === 0 && (
          <Typography color="text.secondary">
            No accounts yet. Add one to enable rotation.
          </Typography>
        )}
      </Stack>
    </>
  );
}

export default AccountList;
