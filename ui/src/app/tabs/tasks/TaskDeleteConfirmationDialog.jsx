import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';

function getDeleteTargetLabel(task) {
  if (!task) {
    return 'this task';
  }
  return task.branchName || task.taskId || 'this task';
}

function TaskDeleteConfirmationDialog({
  loading = false,
  onClose,
  onConfirm,
  open,
  task
}) {
  const targetLabel = getDeleteTargetLabel(task);

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      aria-labelledby="task-delete-confirmation-title"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="task-delete-confirmation-title">Delete task?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Delete {targetLabel}? This removes the task and its stored run data. This cannot be undone.
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
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskDeleteConfirmationDialog;
