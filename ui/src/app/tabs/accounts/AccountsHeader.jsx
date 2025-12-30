import { Button, Stack, Typography } from '@mui/material';

function AccountsHeader({ accountsState, data }) {
  const { loading } = data;

  return (
    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
      <Typography variant="h6" className="panel-title">
        Accounts
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => accountsState.refreshAccounts()}
        disabled={loading}
      >
        Refresh
      </Button>
    </Stack>
  );
}

export default AccountsHeader;
