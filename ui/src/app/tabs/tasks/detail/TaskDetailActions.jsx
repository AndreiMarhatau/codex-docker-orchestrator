import { useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import TaskResumeDialog from './TaskResumeDialog.jsx';

function TaskDetailActions({ data, hasTaskDetail, isRunning, showPush, tasksState }) {
  const { actions, detail, handleResumeModelChoiceChange } = tasksState;
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);

  return (
    <>
      <Box className="task-detail-actions">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {hasTaskDetail && !isRunning && (
            <Button
              variant="contained"
              onClick={() => setResumeDialogOpen(true)}
              disabled={data.loading}
            >
              Ask for changes
            </Button>
          )}
          {hasTaskDetail && showPush && (
            <Button
              variant="outlined"
              onClick={actions.handlePushTask}
              disabled={data.loading}
            >
              Push
            </Button>
          )}
          {hasTaskDetail && isRunning && (
            <Button
              color="error"
              onClick={() => actions.handleStopTask(detail.taskDetail?.taskId)}
              disabled={data.loading}
              startIcon={<StopCircleOutlinedIcon />}
            >
              Stop
            </Button>
          )}
        </Stack>
      </Box>
      <TaskResumeDialog
        actions={actions}
        data={data}
        detail={detail}
        envs={data.envs}
        handleResumeModelChoiceChange={handleResumeModelChoiceChange}
        open={resumeDialogOpen}
        onClose={() => setResumeDialogOpen(false)}
      />
    </>
  );
}

export default TaskDetailActions;
