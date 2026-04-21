import { Box, Button, Collapse, Stack, TextField, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

function AccountForm({ accountsState, data }) {
  const { loading } = data;

  return (
    <Box className="dense-panel dense-panel--form">
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.35}>
            <Typography variant="h6" className="dense-panel-title">Add account</Typography>
            <Typography color="text.secondary" className="dense-panel-copy">
              Paste credentials from a local `auth.json` file so the rotation queue can use them.
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
          <Stack spacing={1.25}>
            <Typography color="text.secondary" className="dense-panel-copy">
              Copy credentials from a local terminal and paste them here.
            </Typography>
            <Box className="log-box dense-code-box">
              <pre>{`CODEX_HOME="$PWD/.codex-auth" sh -c 'mkdir -p "$CODEX_HOME" && codex login' && cat "$PWD/.codex-auth/auth.json"`}</pre>
            </Box>
            <Stack spacing={1.25}>
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
                sx={{ alignSelf: 'flex-start' }}
              >
                Add account
              </Button>
            </Stack>
          </Stack>
        </Collapse>
      </Stack>
    </Box>
  );
}

export default AccountForm;
