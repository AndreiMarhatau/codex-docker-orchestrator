import { Box, Button, Stack, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

function TasksHeader({ tasksState }) {
  const { formState, hasActiveRuns, taskStats } = tasksState;

  return (
    <Box className="subpanel-card">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Stack spacing={0.65} sx={{ minWidth: 0 }}>
          <Typography variant="h5" className="panel-title">
            Tasks
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Track active work, inspect outputs, and move between prompt, run state, and git changes
            without losing the thread.
          </Typography>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Typography color="text.secondary" variant="body2">
              {taskStats.total} total
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {taskStats.running} running
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {Math.max(taskStats.failed, 0)} failed
            </Typography>
          </Stack>
          <Typography color="text.secondary" variant="body2">
            {hasActiveRuns
              ? 'Live activity is streaming through the board.'
              : 'No active runs are streaming output.'}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => formState.setShowTaskForm(true)}
          sx={{ flexShrink: 0 }}
        >
          New task
        </Button>
      </Stack>
    </Box>
  );
}

export default TasksHeader;
