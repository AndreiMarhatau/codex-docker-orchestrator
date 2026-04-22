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
import TaskResumeDialogBody from './TaskResumeDialogBody.jsx';

function TaskResumeDialog({
  actions,
  data,
  detail,
  envs,
  handleResumeModelChoiceChange,
  onClose,
  open
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const dialogBusy = data.loading || detail.resumeFiles.taskFileUploading;
  const taskIsActive =
    detail.taskDetail?.status === 'running' || detail.taskDetail?.status === 'stopping';
  const uploadPercent = Math.max(
    0,
    Math.min(100, Math.round(detail.resumeFiles.taskFileUploadProgress?.percent || 0))
  );

  const closeDialog = () => {
    if (!dialogBusy) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      aria-label="Ask for changes"
      PaperProps={{ className: 'task-compose-dialog' }}
    >
      <DialogTitle className="task-compose-dialog-title">
        <span>Ask for Changes</span>
        <IconButton aria-label="Close" onClick={closeDialog} size="small" disabled={dialogBusy}>
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="task-compose-dialog-content">
        <TaskResumeDialogBody
          data={data}
          detail={detail}
          dialogBusy={dialogBusy}
          envs={envs}
          handleResumeModelChoiceChange={handleResumeModelChoiceChange}
        />
      </DialogContent>
      <DialogActions className="task-compose-dialog-actions">
        <Button onClick={closeDialog} disabled={dialogBusy}>Cancel</Button>
        <Button
          variant="contained"
          onClick={async () => {
            const completed = await actions.handleResumeTask();
            if (completed !== false) {
              onClose();
            }
          }}
          disabled={dialogBusy || taskIsActive || !detail.resumePrompt.trim()}
        >
          {detail.resumeFiles.taskFileUploading ? `Uploading... ${uploadPercent}%` : 'Continue Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskResumeDialog;
