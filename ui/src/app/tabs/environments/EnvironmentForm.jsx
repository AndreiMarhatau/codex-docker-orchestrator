import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';

function EnvironmentForm({ envForm, handleCreateEnv, inDialog = false, loading, setEnvForm }) {
  return (
    <Box className={inDialog ? '' : 'dense-panel dense-panel--form'}>
      <Stack spacing={1.5}>
        <Stack spacing={0.35}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FolderOpenOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="h6" className="dense-panel-title">Create source</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" className="dense-panel-copy">
            Add the repo URL, default branch, and environment variables Codex should inherit.
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
          placeholder="KEY=VALUE"
          helperText="Use one line per variable. Keep secrets here only if the repo workflow requires them."
          value={envForm.envVarsText}
          onChange={(event) => setEnvForm((prev) => ({ ...prev, envVarsText: event.target.value }))}
        />
        <Button
          variant="contained"
          onClick={handleCreateEnv}
          disabled={loading || !envForm.repoUrl.trim()}
          sx={{ alignSelf: 'flex-start' }}
        >
          Register source
        </Button>
      </Stack>
    </Box>
  );
}

export default EnvironmentForm;
