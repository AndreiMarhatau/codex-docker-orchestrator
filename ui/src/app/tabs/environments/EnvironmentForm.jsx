import { Button, Stack, TextField, Typography } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';

function EnvironmentForm({ envForm, handleCreateEnv, loading, setEnvForm }) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <FolderOpenOutlinedIcon color="primary" />
        <Typography variant="h6" className="panel-title">
          Create environment
        </Typography>
      </Stack>
      <TextField
        label="Repository URL"
        fullWidth
        value={envForm.repoUrl}
        onChange={(event) => setEnvForm((prev) => ({ ...prev, repoUrl: event.target.value }))}
      />
      <TextField
        label="Default branch"
        fullWidth
        value={envForm.defaultBranch}
        onChange={(event) =>
          setEnvForm((prev) => ({ ...prev, defaultBranch: event.target.value }))
        }
      />
      <TextField
        label="Environment variables"
        fullWidth
        multiline
        minRows={4}
        placeholder="FOO=bar\nAPI_TOKEN=abc123"
        helperText="One per line as KEY=VALUE. Values are passed through to Codex."
        value={envForm.envVarsText}
        onChange={(event) => setEnvForm((prev) => ({ ...prev, envVarsText: event.target.value }))}
      />
      <Button
        variant="contained"
        onClick={handleCreateEnv}
        disabled={loading || !envForm.repoUrl.trim()}
      >
        Create environment
      </Button>
    </Stack>
  );
}

export default EnvironmentForm;
