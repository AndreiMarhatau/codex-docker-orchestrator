import { Box, Stack, Typography } from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import UploadProgress from '../../../components/UploadProgress.jsx';
import { MAX_TASK_FILES } from '../../../constants.js';
import { formatBytes } from '../../../formatters.js';
import TaskFormBasics from './TaskFormBasics.jsx';
import TaskFormContextRepos from './TaskFormContextRepos.jsx';
import TaskFormModel from './TaskFormModel.jsx';

function TaskFileList({ files }) {
  if (files.taskFiles.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.85} className="task-compose-file-list">
      {files.taskFiles.map((file, index) => (
        <Box key={`${file.name}-${index}`} className="task-compose-file-item">
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
            <Stack spacing={0.15} sx={{ minWidth: 0 }}>
              <Typography className="task-compose-file-name">{file.name}</Typography>
              <Typography className="task-compose-helper">{formatBytes(file.size)}</Typography>
            </Stack>
            <button
              type="button"
              className="task-compose-link-button"
              onClick={() => files.handleRemoveTaskFile(index)}
            >
              Remove
            </button>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function TaskCreateBody({ envs, files, formState, loading, selectedEnv }) {
  const dropzoneDisabled =
    loading || files.taskFileUploading || files.taskFiles.length >= MAX_TASK_FILES;

  function handleDropzoneKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    files.taskFileInputRef.current?.click();
  }

  function handleDropzoneDrop(event) {
    event.preventDefault();
    if (dropzoneDisabled) {
      return;
    }
    files.handleTaskFilesDropped(event.dataTransfer?.files);
  }

  return (
    <Box className="task-compose-grid">
      <Stack spacing={2.25} className="task-compose-column">
        <TaskFormBasics
          envs={envs}
          selectedEnv={selectedEnv}
          setTaskForm={formState.setTaskForm}
          taskForm={formState.taskForm}
        />

        <Box className="task-compose-section">
          <Typography className="task-compose-label">Attach files (optional)</Typography>
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
              ref={files.taskFileInputRef}
              type="file"
              hidden
              multiple
              onChange={files.handleTaskFilesSelected}
              disabled={dropzoneDisabled}
            />
            <AttachFileOutlinedIcon fontSize="small" />
            <span className="task-compose-dropzone-title">Drag &amp; drop files here</span>
            <span className="task-compose-dropzone-subtitle">or click to browse</span>
          </label>
          <Typography className="task-compose-helper">
            Max {MAX_TASK_FILES} files • 50 MB per file
          </Typography>
          {files.taskFileError && <Typography color="error">{files.taskFileError}</Typography>}
          <UploadProgress progress={files.taskFileUploadProgress} />
          <TaskFileList files={files} />
        </Box>
      </Stack>

      <Stack spacing={2.25} className="task-compose-column">
        <TaskFormModel
          handleTaskModelChoiceChange={formState.handleTaskModelChoiceChange}
          setTaskForm={formState.setTaskForm}
          taskForm={formState.taskForm}
        />

        <Box className="task-compose-section">
          <Typography className="task-compose-label">
            Additional read-only repositories (optional)
          </Typography>
          <Typography className="task-compose-helper task-compose-helper--section">
            Repositories the agent can read from but cannot modify.
          </Typography>
          <TaskFormContextRepos envs={envs} formState={formState} loading={loading} />
        </Box>
      </Stack>
    </Box>
  );
}

export default TaskCreateBody;
