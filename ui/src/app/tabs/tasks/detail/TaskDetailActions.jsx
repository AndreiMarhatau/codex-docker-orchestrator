import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

function TaskDetailActions({ data, hasTaskDetail, isRunning, showPush, tasksState }) {
  const { actions, detail } = tasksState;
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
        open={resumeDialogOpen}
        onClose={() => setResumeDialogOpen(false)}
      />
    </>
  );
}

function TaskResumeDialog({ actions, data, detail, onClose, open }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ask for changes</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            Provide the follow-up prompt to continue this task.
          </Typography>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Continuation prompt
            </Typography>
            <textarea
              className="task-resume-textarea"
              rows={4}
              value={detail.resumePrompt}
              onChange={(event) => detail.setResumePrompt(event.target.value)}
              disabled={data.loading}
              aria-label="Continuation prompt"
            />
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Checkbox
                  checked={detail.resumeUseHostDockerSocket}
                  onChange={(event) => {
                    detail.setResumeUseHostDockerSocket(event.target.checked);
                    detail.setResumeDockerTouched(true);
                  }}
                />
              }
              label="Use host Docker socket for this run"
            />
            <Tooltip title="Grants root-equivalent access to the host via Docker. Disable if you do not trust the task.">
              <WarningAmberIcon color="warning" fontSize="small" />
            </Tooltip>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            actions.handleResumeTask();
            onClose();
          }}
          disabled={data.loading || !detail.resumePrompt.trim()}
        >
          Continue task
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskDetailActions;
