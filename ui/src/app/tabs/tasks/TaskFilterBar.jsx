import { Box, MenuItem, TextField } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function TaskFilterBar({ compact = false, data, tasksState }) {
  const { envs } = data;
  const { selection } = tasksState;

  return (
    <Box className={`task-filter-panel${compact ? ' task-filter-panel--compact' : ''}`}>
      <TextField
        select
        size="small"
        label="Filter by environment"
        value={selection.taskFilterEnvId}
        onChange={(event) => selection.setTaskFilterEnvId(event.target.value)}
        className="task-filter-select"
        SelectProps={{
          inputProps: {
            'aria-label': 'Environment filter'
          }
        }}
      >
        <MenuItem value="">All environments</MenuItem>
        {envs.map((env) => (
          <MenuItem key={env.envId} value={env.envId}>
            {formatRepoDisplay(env.repoUrl) || env.repoUrl}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

export default TaskFilterBar;
