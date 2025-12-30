import { Box, Button, Collapse, Stack, TextField, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

function AccountForm({ accountsState, data }) {
  const { loading } = data;

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Add account</Typography>
          <Typography color="text.secondary">
            Paste credentials from a local auth.json file.
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddOutlinedIcon />}
          onClick={() => accountsState.setShowAccountForm((prev) => !prev)}
        >
          {accountsState.showAccountForm ? 'Hide form' : 'New account'}
        </Button>
      </Stack>
      <Collapse in={accountsState.showAccountForm} unmountOnExit>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            Copy credentials from any local terminal and paste them here.
          </Typography>
          <Box className="log-box">
            <pre>{`CODEX_HOME="$PWD/.codex-auth" sh -c 'mkdir -p "$CODEX_HOME" && codex login' && cat "$PWD/.codex-auth/auth.json"`}</pre>
          </Box>
          <Stack spacing={2}>
            <TextField
              label="Account label"
              fullWidth
              value={accountsState.accountForm.label}
              onChange={(event) =>
                accountsState.setAccountForm((prev) => ({ ...prev, label: event.target.value }))
              }
              placeholder="Personal / Work / Alt"
            />
            <TextField
              label="auth.json contents"
              fullWidth
              multiline
              minRows={6}
              value={accountsState.accountForm.authJson}
              onChange={(event) =>
                accountsState.setAccountForm((prev) => ({ ...prev, authJson: event.target.value }))
              }
              placeholder="{...}"
            />
            <Button
              variant="contained"
              onClick={accountsState.handleAddAccount}
              disabled={loading || !accountsState.accountForm.authJson.trim()}
            >
              Add account
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </>
  );
}

export default AccountForm;
