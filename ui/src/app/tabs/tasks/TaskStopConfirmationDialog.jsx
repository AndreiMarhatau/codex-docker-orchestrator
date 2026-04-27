import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';

function getStopTargetLabel(task) {
  if (!task) {
    return 'this task';
  }
  return task.branchName || task.taskId || 'this task';
}

function TaskStopConfirmationDialog({
  loading = false,
  onClose,
  onConfirm,
  open,
  task
}) {
  const targetLabel = getStopTargetLabel(task);

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      aria-labelledby="task-stop-confirmation-title"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="task-stop-confirmation-title">Stop task?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Stop {targetLabel}? The current run will be interrupted and marked as stopped.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
        >
          Stop
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskStopConfirmationDialog;
