import { Stack, Typography } from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import UploadProgress from '../../../components/UploadProgress.jsx';
import { MAX_TASK_FILES } from '../../../constants.js';
import { formatBytes } from '../../../formatters.js';
import TaskDockerToggle from '../form/TaskDockerToggle.jsx';
import TaskFormContextRepos from '../form/TaskFormContextRepos.jsx';
import RunOverrideForm from './RunOverrideForm.jsx';

function ExistingAttachmentList({ detail, loading }) {
  const attachments = detail.taskDetail?.attachments || [];

  if (attachments.length === 0) {
    return (
      <Typography color="text.secondary">No files from the latest run.</Typography>
    );
  }

  return (
    <Stack spacing={0.85} className="task-compose-file-list">
      {attachments.map((file) => {
        const pendingRemoval = detail.resumeAttachmentRemovals.includes(file.name);
        return (
          <div key={file.name} className={`task-compose-file-item${pendingRemoval ? ' is-pending-removal' : ''}`}>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Stack spacing={0.15} sx={{ minWidth: 0 }}>
                <Typography className="task-compose-file-name">
                  {file.originalName || file.name}
                </Typography>
                <Typography className="task-compose-helper">{formatBytes(file.size)}</Typography>
              </Stack>
              <button
                type="button"
                className="task-compose-link-button"
                onClick={() => detail.toggleResumeAttachmentRemoval(file.name)}
                disabled={loading}
              >
                {pendingRemoval ? 'Keep' : 'Remove'}
              </button>
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
}

function NewAttachmentList({ detail, loading }) {
  if (detail.resumeFiles.taskFiles.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.85} className="task-compose-file-list">
      {detail.resumeFiles.taskFiles.map((file, index) => (
        <div key={`${file.name}-${index}`} className="task-compose-file-item">
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
            <Stack spacing={0.15} sx={{ minWidth: 0 }}>
              <Typography className="task-compose-file-name">{file.name}</Typography>
              <Typography className="task-compose-helper">{formatBytes(file.size)}</Typography>
            </Stack>
            <button
              type="button"
              className="task-compose-link-button"
              onClick={() => detail.resumeFiles.handleRemoveTaskFile(index)}
              disabled={loading}
            >
              Remove
            </button>
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

function TaskResumeDialogBody({
  data,
  detail,
  dialogBusy,
  envs,
  handleResumeModelChoiceChange
}) {
  const uploadProgress = detail.resumeFiles.taskFileUploadProgress;
  const dropzoneDisabled = dialogBusy || detail.resumeFiles.taskFiles.length >= MAX_TASK_FILES;
  const resumeContextState = {
    handleAddContextRepo: detail.handleAddResumeContextRepo,
    handleContextRepoChange: detail.handleResumeContextRepoChange,
    handleRemoveContextRepo: detail.handleRemoveResumeContextRepo,
    taskForm: { contextRepos: detail.resumeContextRepos },
    usedContextEnvIds: detail.resumeUsedContextEnvIds
  };

  function handleDropzoneKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    detail.resumeFiles.taskFileInputRef.current?.click();
  }

  function handleDropzoneDrop(event) {
    event.preventDefault();
    if (dropzoneDisabled) {
      return;
    }
    detail.resumeFiles.handleTaskFilesDropped(event.dataTransfer?.files);
  }

  return (
    <div className="task-compose-grid">
      <Stack spacing={2.25} className="task-compose-column">
        <Stack spacing={2.25}>
          <Stack spacing={0.7}>
            <Typography className="task-compose-helper">
              Continuing <strong>{detail.taskDetail?.branchName || 'current branch'}</strong>
            </Typography>
            <textarea
              className="task-compose-textarea"
              value={detail.resumePrompt}
              onChange={(event) => detail.setResumePrompt(event.target.value)}
              disabled={dialogBusy}
              placeholder="Describe what the agent should do..."
              rows={8}
              aria-label="Continuation prompt"
            />
            <Typography className="task-compose-helper">
              Be specific and include context, goals, and constraints.
            </Typography>
          </Stack>

          <Stack spacing={1.15} className="task-compose-section">
            <Typography className="task-compose-label">Attached files from latest run</Typography>
            <ExistingAttachmentList detail={detail} loading={dialogBusy} />
          </Stack>

          <Stack spacing={1.15} className="task-compose-section">
            <Typography className="task-compose-label">Add files (optional)</Typography>
            <label
              className="task-compose-dropzone"
              role="button"
              tabIndex={dropzoneDisabled ? -1 : 0}
              aria-disabled={dropzoneDisabled}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDropzoneDrop}
              onKeyDown={handleDropzoneKeyDown}
            >
              <input
                ref={detail.resumeFiles.taskFileInputRef}
                type="file"
                hidden
                multiple
                onChange={detail.resumeFiles.handleTaskFilesSelected}
                disabled={dropzoneDisabled}
              />
              <AttachFileOutlinedIcon fontSize="small" />
              <span className="task-compose-dropzone-title">Drag &amp; drop files here</span>
              <span className="task-compose-dropzone-subtitle">or click to browse</span>
            </label>
            <Typography className="task-compose-helper">
              Max {MAX_TASK_FILES} files • 50 MB per file
            </Typography>
            {detail.resumeFiles.taskFileError && (
              <Typography color="error">{detail.resumeFiles.taskFileError}</Typography>
            )}
            <UploadProgress progress={uploadProgress} />
            <NewAttachmentList detail={detail} loading={dialogBusy} />
          </Stack>
        </Stack>
      </Stack>

      <Stack spacing={2.25} className="task-compose-column">
        <RunOverrideForm
          detail={detail}
          handleResumeModelChoiceChange={handleResumeModelChoiceChange}
          modelHelper="If not specified, the task model will be used."
          effortHelper="If not specified, the task effort will be used."
        />

        <TaskDockerToggle
          checked={detail.resumeUseHostDockerSocket}
          onChange={(event) => {
            detail.setResumeUseHostDockerSocket(event.target.checked);
            detail.setResumeDockerTouched(true);
          }}
          warningTooltip="Runs Docker using the orchestrator's isolated per-task sidecar daemon."
        />

        <Stack spacing={1.15} className="task-compose-section">
          <Typography className="task-compose-label">
            Additional read-only repositories (optional)
          </Typography>
          <Typography className="task-compose-helper task-compose-helper--section">
            Repositories from the latest run are pre-filled. Remove them or add more for this continuation.
          </Typography>
          <TaskFormContextRepos envs={envs} formState={resumeContextState} loading={data.loading} />
        </Stack>
      </Stack>
    </div>
  );
}

export default TaskResumeDialogBody;
