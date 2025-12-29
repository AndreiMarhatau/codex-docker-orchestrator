import { Button, Chip, Stack, Typography } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { formatRepoDisplay } from '../../repo-helpers.js';

function EnvironmentHeader({ envs, loading, refreshAll, selectedEnv }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FolderOpenOutlinedIcon color="primary" />
          <Typography variant="h6" className="panel-title">
            Environments
          </Typography>
        </Stack>
        <Typography color="text.secondary">
          Create and manage repo sources for Codex runs.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`${envs.length} environments`} size="small" />
          <Chip
            label={`Selected: ${selectedEnv ? formatRepoDisplay(selectedEnv.repoUrl) : 'none'}`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Stack>
      <Button variant="outlined" size="small" onClick={refreshAll} disabled={loading}>
        Sync now
      </Button>
    </Stack>
  );
}

export default EnvironmentHeader;
