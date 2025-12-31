import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import TaskDetailHeader from './detail/TaskDetailHeader.jsx';
import TaskDiff from './detail/TaskDiff.jsx';
import TaskResumeControls from './detail/TaskResumeControls.jsx';
import TaskRuns from './detail/TaskRuns.jsx';

function TaskDetailPanel({ data, tasksState }) {
  const { refreshAll } = data;
  const { selection } = tasksState;
  const hasTaskDetail = Boolean(tasksState.detail.taskDetail);

  return (
    <Box className="task-detail-shell">
      <Box className="task-detail-top">
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
      </Box>
      <Box className="task-detail-body">
        {!hasTaskDetail && (
          <Typography color="text.secondary">Loading task details...</Typography>
        )}
        {hasTaskDetail && (
          <Stack spacing={2}>
            <TaskDetailHeader tasksState={tasksState} />
            <TaskDiff tasksState={tasksState} />
            <TaskRuns tasksState={tasksState} />
            <TaskResumeControls loading={data.loading} tasksState={tasksState} />
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export default TaskDetailPanel;
