import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function TaskFilterBar({ compact = false, data, tasksState }) {
  const { envs } = data;
  const { selection } = tasksState;
  const selectedEnv = envs.find((env) => env.envId === selection.taskFilterEnvId);

  return (
    <Box className={`subpanel-card${compact ? ' subpanel-card--compact' : ''}`}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">Filter by environment</Typography>
          <Typography color="text.secondary" variant="body2">
            {selectedEnv
              ? `Showing ${formatRepoDisplay(selectedEnv.repoUrl) || selectedEnv.repoUrl}.`
              : 'Keep the list focused on one environment.'}
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Environment filter"
            value={selection.taskFilterEnvId}
            onChange={(event) => selection.setTaskFilterEnvId(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 260 }, flexShrink: 0 }}
          >
            <MenuItem value="">All environments</MenuItem>
            {envs.map((env) => (
              <MenuItem key={env.envId} value={env.envId}>
                {formatRepoDisplay(env.repoUrl) || env.repoUrl}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
    </Box>
  );
}

export default TaskFilterBar;
