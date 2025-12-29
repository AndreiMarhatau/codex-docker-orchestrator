import { Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import TaskDetailHeader from './detail/TaskDetailHeader.jsx';
import TaskDiff from './detail/TaskDiff.jsx';
import TaskResumeControls from './detail/TaskResumeControls.jsx';
import TaskRuns from './detail/TaskRuns.jsx';

function TaskDetailPanel({ data, tasksState }) {
  const { refreshAll } = data;
  const { selection } = tasksState;

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Back to tasks">
            <IconButton
              size="small"
              color="primary"
              onClick={selection.handleBackToTasks}
              aria-label="Back to tasks"
            >
              <ArrowBackOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" className="panel-title">
            Task details
          </Typography>
        </Stack>
        <Button size="small" variant="outlined" onClick={refreshAll}>
          Refresh
        </Button>
      </Stack>
      {!tasksState.detail.taskDetail && (
        <Typography color="text.secondary">Loading task details...</Typography>
      )}
      {tasksState.detail.taskDetail && (
        <Stack spacing={2}>
          <TaskDetailHeader tasksState={tasksState} />
          <TaskDiff tasksState={tasksState} />
          <TaskRuns tasksState={tasksState} />
          <TaskResumeControls loading={data.loading} tasksState={tasksState} />
        </Stack>
      )}
    </Stack>
  );
}

export default TaskDetailPanel;
