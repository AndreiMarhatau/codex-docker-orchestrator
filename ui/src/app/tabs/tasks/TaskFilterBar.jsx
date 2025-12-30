import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function TaskFilterBar({ data, tasksState }) {
  const { envs, refreshAll } = data;
  const { formState, selection } = tasksState;

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <TextField
          select
          size="small"
          label="Filter"
          value={selection.taskFilterEnvId}
          onChange={(event) => selection.setTaskFilterEnvId(event.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">All environments</MenuItem>
          {envs.map((env) => (
            <MenuItem key={env.envId} value={env.envId}>
              {formatRepoDisplay(env.repoUrl) || env.repoUrl}
            </MenuItem>
          ))}
        </TextField>
        <Button size="small" variant="outlined" onClick={refreshAll}>
          Refresh
        </Button>
      </Stack>
      <Button
        size="small"
        variant={formState.showTaskForm ? 'outlined' : 'contained'}
        onClick={() => formState.setShowTaskForm((prev) => !prev)}
      >
        {formState.showTaskForm ? 'Hide new task' : 'New task'}
      </Button>
    </Stack>
  );
}

export default TaskFilterBar;
