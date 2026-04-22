import { useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import TaskResumeDialog from './TaskResumeDialog.jsx';

function TaskDetailActions({ data, hasTaskDetail, isRunning = false, showPush, tasksState }) {
  const { actions, detail, handleResumeModelChoiceChange } = tasksState;
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);

  return (
    <>
      <Box className="task-detail-actions">
        <Stack direction="row" spacing={1.5}>
          {hasTaskDetail && (
            <Button
              variant="outlined"
              onClick={() => setResumeDialogOpen(true)}
              disabled={data.loading || isRunning}
            >
              Ask for changes
            </Button>
          )}
          {hasTaskDetail && showPush && (
            <Button
              variant="contained"
              onClick={actions.handlePushTask}
              disabled={data.loading}
            >
              Push
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
