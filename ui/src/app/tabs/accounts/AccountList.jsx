import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { formatTimestamp } from '../../formatters.js';
import { formatAccountLabel } from '../../repo-helpers.js';

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
    const updated = payload?.accounts?.find((account) => account.id === accountId);
    if (updated) {
      setAuthDrafts((prev) => ({ ...prev, [accountId]: updated.authJson ?? '' }));
    }
  };

  return (
    <>
      <Stack spacing={1.5}>
        {accountState.accounts.map((account) => {
          const currentAuth = account.authJson ?? '';
          const authDraft = authDrafts[account.id] ?? currentAuth;
          const authChanged = authDraft !== currentAuth;

          return (
            <Card key={account.id} className="task-card">
              <CardContent>
                <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography fontWeight={600}>{formatAccountLabel(account)}</Typography>
                  {account.isActive && <Chip size="small" color="success" label="Active" />}
                </Stack>
                <Typography color="text.secondary" className="mono">
                  {account.id}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={`Queue #${account.position}`} />
                  {account.createdAt && (
                    <Chip size="small" label={`Added ${formatTimestamp(account.createdAt)}`} />
                  )}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => accountsState.handleActivateAccount(account.id)}
                    disabled={loading || account.isActive}
                  >
                    Make active
                  </Button>
                  <Button
                    size="small"
                    color="secondary"
                    onClick={() => accountsState.handleDeleteAccount(account.id)}
                    disabled={loading || account.isActive}
                  >
                    Remove
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => toggleRename(account)}
                    disabled={loading}
                  >
                    {renameExpanded[account.id] ? 'Cancel rename' : 'Rename'}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => toggleAuth(account)}
                  >
                    {authExpanded[account.id] ? 'Hide auth.json' : 'Show auth.json'}
                  </Button>
                </Stack>
                <Collapse in={renameExpanded[account.id]} unmountOnExit>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      label="New label"
                      size="small"
                      value={labelDrafts[account.id] ?? account.label ?? ''}
                      onChange={(event) => handleRenameChange(account.id, event.target.value)}
                      disabled={loading}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleRenameSave(account.id)}
                        disabled={
                          loading ||
                          (labelDrafts[account.id] ?? '').trim() === (account.label ?? '').trim()
                        }
                      >
                        Save name
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => toggleRename(account)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                </Collapse>
                <Collapse in={authExpanded[account.id]} unmountOnExit>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      label="Stored auth.json"
                      size="small"
                      multiline
                      minRows={6}
                      value={authDraft}
                      placeholder="No auth.json available."
                      onChange={(event) => handleAuthChange(account.id, event.target.value)}
                      disabled={loading}
                      inputProps={{ className: 'mono' }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleAuthSave(account.id)}
                        disabled={loading || !authChanged}
                      >
                        Save
                      </Button>
                    </Stack>
                  </Stack>
                </Collapse>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
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
