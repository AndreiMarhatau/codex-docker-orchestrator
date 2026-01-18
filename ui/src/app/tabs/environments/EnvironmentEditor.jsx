import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function EnvironmentEditor({
  envEditForm,
  handleUpdateEnv,
  isOpen,
  loading,
  onClose,
  selectedEnv,
  setEnvEditForm,
  resetEnvEditForm,
  isDirty
}) {
  const repoLabel = selectedEnv
    ? formatRepoDisplay(selectedEnv.repoUrl) || selectedEnv.repoUrl
    : '';
  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit environment</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Repository"
            fullWidth
            value={repoLabel}
            InputProps={{ readOnly: true }}
          />
          {!selectedEnv && (
            <Typography color="text.secondary">
              Select an environment to edit its base branch and variables.
            </Typography>
          )}
          {selectedEnv && (
            <>
              <TextField
                label="Base branch"
                fullWidth
                value={envEditForm.defaultBranch}
                onChange={(event) =>
                  setEnvEditForm((prev) => ({ ...prev, defaultBranch: event.target.value }))
                }
              />
              <TextField
                label="Selected environment variables"
                fullWidth
                multiline
                minRows={4}
                placeholder="KEY=VALUE"
                helperText="One per line. Example: FOO=bar, API_TOKEN=abc123"
                value={envEditForm.envVarsText}
                onChange={(event) =>
                  setEnvEditForm((prev) => ({ ...prev, envVarsText: event.target.value }))
                }
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="text" onClick={resetEnvEditForm} disabled={loading || !isDirty}>
          Reset
        </Button>
        <Button
          variant="contained"
          onClick={handleUpdateEnv}
          disabled={loading || !selectedEnv || !envEditForm.defaultBranch.trim() || !isDirty}
        >
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default EnvironmentEditor;
