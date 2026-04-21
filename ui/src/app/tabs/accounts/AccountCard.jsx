import {
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { formatTimestamp } from '../../formatters.js';
import { formatAccountLabel } from '../../repo-helpers.js';

function SectionShell({ children }) {
  return (
    <Box className="dense-inline-section">
      {children}
    </Box>
  );
}

function RenameSection({ account, labelDraft, loading, onRenameChange, onRenameSave, onToggleRename }) {
  return (
    <SectionShell>
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary" className="dense-panel-copy">
          Rename the account so the queue stays readable.
        </Typography>
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
          <Button size="small" variant="outlined" onClick={onToggleRename} disabled={loading}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </SectionShell>
  );
}

function AuthSection({ authDraft, authChanged, loading, onAuthChange, onAuthSave }) {
  return (
    <SectionShell>
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary" className="dense-panel-copy">
          Update the stored auth payload if the session was refreshed outside the UI.
        </Typography>
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
          <Button size="small" variant="contained" onClick={onAuthSave} disabled={loading || !authChanged}>
            Save
          </Button>
        </Stack>
      </Stack>
    </SectionShell>
  );
}

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
    <Box className="dense-list-row" sx={{ py: 1.1, px: 0.25 }}>
      <Stack spacing={0.9}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.35}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <Typography fontWeight={600}>{formatAccountLabel(account)}</Typography>
              {account.isActive && <Chip size="small" className="dense-inline-chip" color="success" label="Active" />}
              <Chip size="small" className="dense-inline-chip" label={`Queue #${account.position}`} />
            </Stack>
            <Typography color="text.secondary" variant="body2" className="mono">
              {account.id}
            </Typography>
          </Stack>
          {account.createdAt && (
            <Typography variant="body2" color="text.secondary">
              Added {formatTimestamp(account.createdAt)}
            </Typography>
          )}
        </Stack>
        <Stack className="dense-actions" direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
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
            variant="text"
            color="secondary"
            onClick={() => accountsState.handleDeleteAccount(account.id)}
            disabled={loading || account.isActive}
          >
            Remove
          </Button>
          <Button size="small" variant="text" onClick={onToggleRename} disabled={loading}>
            {renameExpanded ? 'Hide rename' : 'Rename'}
          </Button>
          <Button size="small" variant="text" onClick={onToggleAuth}>
            {authExpanded ? 'Hide auth.json' : 'Show auth.json'}
          </Button>
        </Stack>
        <Collapse in={renameExpanded} unmountOnExit>
          <RenameSection
            account={account}
            labelDraft={labelDraft}
            loading={loading}
            onRenameChange={onRenameChange}
            onRenameSave={onRenameSave}
            onToggleRename={onToggleRename}
          />
        </Collapse>
        <Collapse in={authExpanded} unmountOnExit>
          <AuthSection
            authDraft={authDraft}
            authChanged={authChanged}
            loading={loading}
            onAuthChange={onAuthChange}
            onAuthSave={onAuthSave}
          />
        </Collapse>
      </Stack>
    </Box>
  );
}

export default AccountCard;
