/* eslint-disable max-lines, max-lines-per-function */
import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip
} from '@mui/material';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TaskResumeDialog from './TaskResumeDialog.jsx';
import { readComposeQuery, writeComposeQuery } from '../../../query-state.js';
import { isTaskStoppableStatus } from '../../../task-helpers.js';

const REVIEW_TARGETS = [
  { value: 'uncommittedChanges', label: 'Uncommitted changes' },
  { value: 'baseBranch', label: 'Against base branch' },
  { value: 'commit', label: 'Commit' },
  { value: 'custom', label: 'Custom prompt' }
];

function DetailActionIconButton({ children, color = 'primary', disabled, label, onClick }) {
  return (
    <Tooltip title={label}>
      <span className="task-detail-action-tooltip">
        <IconButton
          aria-label={label}
          className="task-detail-action-button"
          color={color}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function TaskDetailStopAction({ data, hasTaskDetail, onStop, task }) {
  if (!hasTaskDetail || !isTaskStoppableStatus(task?.status)) {
    return null;
  }
  return (
    <DetailActionIconButton
      color="error"
      label="Stop"
      onClick={onStop}
      disabled={data.loading}
    >
      <StopOutlinedIcon fontSize="small" />
    </DetailActionIconButton>
  );
}

function TaskDetailActions({
  data,
  hasTaskDetail,
  isRunning = false,
  onRequestDeleteTask,
  onRequestStopTask,
  showCommitPush,
  tasksState
}) {
  const { actions, detail, handleResumeModelChoiceChange } = tasksState;
  const [resumeDialogOpen, setResumeDialogOpen] = useState(() => readComposeQuery() === 'resume');
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitSubmitting, setCommitSubmitting] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const isPushing = detail.taskDetail?.status === 'pushing';
  const actionBusy = data.loading || isRunning || isPushing;
  const commitBusy = data.loading || commitSubmitting || isPushing;
  const deleteDisabled = data.loading || !detail.taskDetail;
  const [reviewForm, setReviewForm] = useState({
    type: 'uncommittedChanges',
    branch: detail.taskDetail?.ref || 'main',
    sha: '',
    title: '',
    instructions: ''
  });

  function openResumeDialog() {
    writeComposeQuery('resume');
    setResumeDialogOpen(true);
  }

  function closeResumeDialog() {
    writeComposeQuery('');
    setResumeDialogOpen(false);
  }

  async function submitCommitPush() {
    setCommitSubmitting(true);
    try {
      const ok = await actions.handleCommitPushTask(commitMessage);
      if (ok) {
        setCommitDialogOpen(false);
        setCommitMessage('');
      }
    } finally {
      setCommitSubmitting(false);
    }
  }

  function buildReviewPayload() {
    if (reviewForm.type === 'baseBranch') {
      return { type: 'baseBranch', branch: reviewForm.branch };
    }
    if (reviewForm.type === 'commit') {
      return { type: 'commit', sha: reviewForm.sha, title: reviewForm.title };
    }
    if (reviewForm.type === 'custom') {
      return { type: 'custom', instructions: reviewForm.instructions };
    }
    return { type: 'uncommittedChanges' };
  }

  async function submitReview() {
    const ok = await actions.handleReviewTask(buildReviewPayload());
    if (ok) {
      setReviewDialogOpen(false);
    }
  }

  function handleDeleteTask() {
    if (!detail.taskDetail) {
      return;
    }
    if (onRequestDeleteTask) {
      onRequestDeleteTask(detail.taskDetail);
      return;
    }
    actions.handleDeleteTask?.(detail.taskDetail.taskId);
  }

  function handleStopTask() {
    if (!detail.taskDetail) {
      return;
    }
    if (onRequestStopTask) {
      onRequestStopTask(detail.taskDetail);
      return;
    }
    actions.handleStopTask?.(detail.taskDetail.taskId);
  }

  return (
    <>
      <Box className="task-detail-actions">
        <Stack direction="row" spacing={1.5}>
          {hasTaskDetail && (
            <DetailActionIconButton
              label="Ask for changes"
              onClick={openResumeDialog}
              disabled={actionBusy}
            >
              <AddCommentOutlinedIcon fontSize="small" />
            </DetailActionIconButton>
          )}
          {hasTaskDetail && (
            <DetailActionIconButton
              label="Review"
              onClick={() => setReviewDialogOpen(true)}
              disabled={actionBusy}
            >
              <RateReviewOutlinedIcon fontSize="small" />
            </DetailActionIconButton>
          )}
          {hasTaskDetail && showCommitPush && (
            <DetailActionIconButton
              label={isPushing ? 'Pushing' : 'Commit & Push'}
              onClick={() => setCommitDialogOpen(true)}
              disabled={actionBusy}
            >
              {isPushing
                ? <CircularProgress size={18} color="inherit" />
              : <CloudUploadOutlinedIcon fontSize="small" />}
            </DetailActionIconButton>
          )}
          <TaskDetailStopAction
            data={data}
            hasTaskDetail={hasTaskDetail}
            onStop={handleStopTask}
            task={detail.taskDetail}
          />
          {hasTaskDetail && (
            <DetailActionIconButton
              color="error"
              label="Delete"
              onClick={handleDeleteTask}
              disabled={deleteDisabled}
            >
              <DeleteOutlineIcon fontSize="small" />
            </DetailActionIconButton>
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
        onClose={closeResumeDialog}
      />
      <Dialog
        open={commitDialogOpen}
        onClose={() => {
          if (!commitBusy) {
            setCommitDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Commit &amp; Push</DialogTitle>
        <DialogContent>
          <TextField
            label="Commit message"
            fullWidth
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder="Leave empty to generate"
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommitDialogOpen(false)} disabled={commitBusy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitCommitPush}
            disabled={commitBusy}
            startIcon={commitSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {commitSubmitting ? 'Starting' : 'Commit & Push'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Review</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Review target"
              value={reviewForm.type}
              onChange={(event) =>
                setReviewForm((prev) => ({ ...prev, type: event.target.value }))
              }
              fullWidth
            >
              {REVIEW_TARGETS.map((target) => (
                <MenuItem key={target.value} value={target.value}>
                  {target.label}
                </MenuItem>
              ))}
            </TextField>
            {reviewForm.type === 'baseBranch' && (
              <TextField
                label="Base branch"
                value={reviewForm.branch}
                onChange={(event) =>
                  setReviewForm((prev) => ({ ...prev, branch: event.target.value }))
                }
                fullWidth
              />
            )}
            {reviewForm.type === 'commit' && (
              <>
                <TextField
                  label="Commit SHA"
                  value={reviewForm.sha}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, sha: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Title (optional)"
                  value={reviewForm.title}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  fullWidth
                />
              </>
            )}
            {reviewForm.type === 'custom' && (
              <TextField
                label="Review prompt"
                value={reviewForm.instructions}
                onChange={(event) =>
                  setReviewForm((prev) => ({ ...prev, instructions: event.target.value }))
                }
                fullWidth
                multiline
                minRows={4}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)} disabled={data.loading}>Cancel</Button>
          <Button variant="contained" onClick={submitReview} disabled={data.loading}>
            Run Review
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TaskDetailActions;
