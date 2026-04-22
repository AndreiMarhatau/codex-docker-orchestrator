import { useMemo } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  useMediaQuery
} from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { useTheme } from '@mui/material/styles';
import TaskCreateBody from './form/TaskCreateBody.jsx';

function TaskForm({ data, tasksState }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { envs, loading } = data;
  const { actions, files, formState } = tasksState;

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === formState.taskForm.envId) || null,
    [envs, formState.taskForm.envId]
  );

  const uploadPercent = Math.max(
    0,
    Math.min(100, Math.round(files.taskFileUploadProgress?.percent || 0))
  );

  return (
    <Dialog
      open={formState.showTaskForm}
      onClose={() => formState.setShowTaskForm(false)}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      aria-label="New task"
      PaperProps={{ className: 'task-compose-dialog' }}
    >
      <DialogTitle className="task-compose-dialog-title">
        <span>Create New Task</span>
        <IconButton
          aria-label="Close"
          onClick={() => formState.setShowTaskForm(false)}
          size="small"
        >
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="task-compose-dialog-content">
        <TaskCreateBody
          envs={envs}
          files={files}
          formState={formState}
          loading={loading}
          selectedEnv={selectedEnv}
        />
      </DialogContent>
      <DialogActions className="task-compose-dialog-actions">
        <Button onClick={() => formState.setShowTaskForm(false)} disabled={loading || files.taskFileUploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={actions.handleCreateTask}
          disabled={
            loading ||
            files.taskFileUploading ||
            !formState.taskForm.envId ||
            !formState.taskForm.prompt.trim()
          }
        >
          {files.taskFileUploading ? `Uploading... ${uploadPercent}%` : 'Create Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskForm;
