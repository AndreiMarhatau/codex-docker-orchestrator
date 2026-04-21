import { Box, Button, Stack, Typography } from '@mui/material';

function RotationQueue({ accountsState, data }) {
  const { loading, accountState } = data;

  return (
    <Box className="dense-panel dense-panel--compact">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.35}>
          <Typography variant="h6" className="dense-panel-title">Rotation queue</Typography>
          <Typography color="text.secondary" className="dense-panel-copy">
            Active account stays first. Limit failures move the queue forward automatically.
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
    </Box>
  );
}

export default RotationQueue;
