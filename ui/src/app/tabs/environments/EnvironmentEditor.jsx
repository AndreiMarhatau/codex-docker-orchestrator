import { Button, Stack, TextField, Typography } from '@mui/material';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { formatRepoDisplay } from '../../repo-helpers.js';

function EnvironmentEditor({
  envEditForm,
  handleUpdateEnv,
  loading,
  selectedEnv,
  setEnvEditForm,
  resetEnvEditForm,
  isDirty
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TuneOutlinedIcon color="primary" />
        <Typography variant="h6" className="panel-title">
          Edit environment
        </Typography>
      </Stack>
      {!selectedEnv && (
        <Typography color="text.secondary">
          Select an environment to edit its base branch and variables.
        </Typography>
      )}
      {selectedEnv && (
        <>
          <TextField
            label="Repository"
            fullWidth
            value={formatRepoDisplay(selectedEnv.repoUrl) || selectedEnv.repoUrl}
            InputProps={{ readOnly: true }}
          />
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
            placeholder="FOO=bar\nAPI_TOKEN=abc123"
            helperText="One per line as KEY=VALUE. Values are passed through to Codex."
            value={envEditForm.envVarsText}
            onChange={(event) =>
              setEnvEditForm((prev) => ({ ...prev, envVarsText: event.target.value }))
            }
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={handleUpdateEnv}
              disabled={loading || !envEditForm.defaultBranch.trim() || !isDirty}
            >
              Save changes
            </Button>
            <Button variant="text" onClick={resetEnvEditForm} disabled={loading || !isDirty}>
              Reset
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default EnvironmentEditor;
