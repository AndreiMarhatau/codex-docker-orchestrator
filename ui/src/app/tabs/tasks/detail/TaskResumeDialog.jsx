import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { formatBytes } from '../../../formatters.js';
import TaskFormContextRepos from '../form/TaskFormContextRepos.jsx';

function ResumeFilesSection({ data, detail }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Task files</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
        <Button
          variant="outlined"
          component="label"
          disabled={data.loading || detail.resumeFiles.taskFileUploading}
        >
          Add files
          <input
            ref={detail.resumeFiles.taskFileInputRef}
            type="file"
            hidden
            multiple
            onChange={detail.resumeFiles.handleTaskFilesSelected}
          />
        </Button>
        <Typography color="text.secondary">
          Files are mounted read-only and persist across runs.
        </Typography>
      </Stack>
      {detail.resumeFiles.taskFileError && (
        <Typography color="error">{detail.resumeFiles.taskFileError}</Typography>
      )}
      {detail.resumeFiles.taskFiles.length > 0 && (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {detail.resumeFiles.taskFiles.map((file, index) => (
              <Chip
                key={`${file.name}-${index}`}
                label={`${file.name} (${formatBytes(file.size)})`}
                onDelete={() => detail.resumeFiles.handleRemoveTaskFile(index)}
              />
            ))}
          </Stack>
          <Button
            size="small"
            color="secondary"
            onClick={detail.resumeFiles.handleClearTaskFiles}
            disabled={data.loading || detail.resumeFiles.taskFileUploading}
          >
            Clear new files
          </Button>
        </Stack>
      )}
      {detail.taskDetail?.attachments?.length > 0 && (
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="body2">
            Select files to remove before continuing:
          </Typography>
          <Stack spacing={0.5}>
            {detail.taskDetail.attachments.map((file) => (
              <FormControlLabel
                key={file.name}
                control={
                  <Checkbox
                    checked={detail.resumeAttachmentRemovals.includes(file.name)}
                    onChange={() => detail.toggleResumeAttachmentRemoval(file.name)}
                  />
                }
                label={`${file.originalName || file.name} (${formatBytes(file.size)})`}
              />
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function TaskResumeDialog({ actions, data, detail, envs, onClose, open }) {
  const resumeContextState = {
    handleAddContextRepo: detail.handleAddResumeContextRepo,
    handleContextRepoChange: detail.handleResumeContextRepoChange,
    handleRemoveContextRepo: detail.handleRemoveResumeContextRepo,
    taskForm: { contextRepos: detail.resumeContextRepos },
    usedContextEnvIds: detail.resumeUsedContextEnvIds
  };

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
          <FormControlLabel
            control={
              <Checkbox
                checked={detail.resumeRepoReadOnly}
                onChange={(event) => {
                  detail.setResumeRepoReadOnly(event.target.checked);
                  detail.setResumeRepoReadOnlyTouched(true);
                }}
              />
            }
            label="Read-only"
          />
          <TaskFormContextRepos envs={envs} formState={resumeContextState} loading={data.loading} />
          <ResumeFilesSection data={data} detail={detail} />
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
          disabled={
            data.loading || detail.resumeFiles.taskFileUploading || !detail.resumePrompt.trim()
          }
        >
          Continue task
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskResumeDialog;
