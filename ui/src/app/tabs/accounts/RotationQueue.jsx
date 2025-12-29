import { Button, Stack, Typography } from '@mui/material';

function RotationQueue({ accountsState, data }) {
  const { loading, accountState } = data;

  return (
    <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Rotation queue</Typography>
          <Typography color="text.secondary">
            Active account is first. Usage-limit failures auto-rotate.
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={accountsState.handleRotateAccount}
          disabled={loading || accountState.accounts.length < 2}
        >
          Rotate now
        </Button>
    </Stack>
  );
}

export default RotationQueue;
