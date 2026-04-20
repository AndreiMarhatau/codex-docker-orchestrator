import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function TaskFilterBar({ data, tasksState }) {
  const { envs } = data;
  const { selection } = tasksState;
  const selectedEnv = envs.find((env) => env.envId === selection.taskFilterEnvId);

  return (
    <Box className="subpanel-card">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Focus the board</Typography>
          <Typography color="text.secondary" variant="body2">
            {selectedEnv
              ? `Showing tasks for ${formatRepoDisplay(selectedEnv.repoUrl) || selectedEnv.repoUrl}.`
              : 'Narrow the list to one environment or keep everything visible.'}
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Environment filter"
            value={selection.taskFilterEnvId}
            onChange={(event) => selection.setTaskFilterEnvId(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 260 } }}
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
