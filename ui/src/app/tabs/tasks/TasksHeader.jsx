import { Button, Stack, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

function TasksHeader({ compact = false, tasksState }) {
  const { formState, hasActiveRuns, taskStats } = tasksState;

  return (
    <Stack spacing={compact ? 1 : 1.25}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap alignItems="center">
          <Typography variant="h6" className="panel-title">
            Tasks
          </Typography>
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
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => formState.setShowTaskForm(true)}
          sx={{ flexShrink: 0 }}
        >
          New task
        </Button>
      </Stack>
      {!compact && (
        <>
          <Typography color="text.secondary" variant="body2">
            Track active work, inspect outputs, and move between prompt, run state, and git changes without losing the thread.
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {hasActiveRuns
              ? 'Live activity is streaming through the board.'
              : 'No active runs are streaming output.'}
          </Typography>
        </>
      )}
    </Stack>
  );
}

export default TasksHeader;
