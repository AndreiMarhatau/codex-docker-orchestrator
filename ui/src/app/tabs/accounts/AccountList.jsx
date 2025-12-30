import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography
} from '@mui/material';
import { formatTimestamp } from '../../formatters.js';
import { formatAccountLabel } from '../../repo-helpers.js';

function AccountList({ accountsState, data }) {
  const { accountState, loading } = data;

  return (
    <>
      <Stack spacing={1.5}>
        {accountState.accounts.map((account) => (
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
                </Stack>
              </Stack>
            </CardContent>
          </Card>
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
