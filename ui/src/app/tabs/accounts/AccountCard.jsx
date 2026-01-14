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

function AccountCard({
  account,
  accountsState,
  authDraft,
  authExpanded,
  labelDraft,
  loading,
  renameExpanded,
  onAuthChange,
  onAuthSave,
  onToggleAuth,
  onToggleRename,
  onRenameChange,
  onRenameSave
}) {
  const authChanged = authDraft !== (account.authJson ?? '');

  return (
    <Card className="task-card">
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
              onClick={onToggleRename}
              disabled={loading}
            >
              {renameExpanded ? 'Cancel rename' : 'Rename'}
            </Button>
            <Button size="small" variant="text" onClick={onToggleAuth}>
              {authExpanded ? 'Hide auth.json' : 'Show auth.json'}
            </Button>
          </Stack>
          <Collapse in={renameExpanded} unmountOnExit>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                label="New label"
                size="small"
                value={labelDraft}
                onChange={(event) => onRenameChange(event.target.value)}
                disabled={loading}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={onRenameSave}
                  disabled={loading || labelDraft.trim() === (account.label ?? '').trim()}
                >
                  Save name
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onToggleRename}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Collapse>
          <Collapse in={authExpanded} unmountOnExit>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                label="Stored auth.json"
                size="small"
                multiline
                minRows={6}
                value={authDraft}
                placeholder="No auth.json available."
                onChange={(event) => onAuthChange(event.target.value)}
                disabled={loading}
                inputProps={{ className: 'mono' }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={onAuthSave}
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
}

export default AccountCard;
