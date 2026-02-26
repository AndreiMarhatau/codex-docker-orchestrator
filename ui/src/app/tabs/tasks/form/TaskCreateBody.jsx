import { Chip, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { MAX_TASK_FILES } from '../../../constants.js';
import { formatBytes } from '../../../formatters.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';

function TaskCreateBody({
  effectiveRef,
  envLabel,
  envs,
  files,
  formState,
  hasAdvancedSettings,
  hasCustomRef,
  loading,
  modelValue,
  reasoningEffortValue,
  setEnvMenuAnchor,
  setRefPopoverAnchor,
  setSettingsAnchor
}) {
  const activeContextRepos = formState.taskForm.contextRepos
    .map((repo, index) => ({ ...repo, index }))
    .filter((repo) => repo.envId);

  return (
    <Stack spacing={2} sx={{ mt: 0.5 }}>
      <TextField
        label="Task prompt"
        fullWidth
        multiline
        minRows={3}
        value={formState.taskForm.prompt}
        onChange={(event) =>
          formState.setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))
        }
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={`Environment: ${envLabel}`} onClick={(event) => setEnvMenuAnchor(event.currentTarget)} />
        <Chip
          label={`Branch/tag/ref: ${effectiveRef}`}
          onClick={(event) => setRefPopoverAnchor(event.currentTarget)}
          onDelete={hasCustomRef ? () => formState.setTaskForm((prev) => ({ ...prev, ref: '' })) : undefined}
        />
        <Tooltip title="Attach files">
          <IconButton
            size="small"
            component="label"
            color={files.taskFiles.length > 0 ? 'primary' : 'default'}
            aria-label="Add attachments"
            disabled={loading || files.taskFileUploading || files.taskFiles.length >= MAX_TASK_FILES}
          >
            <AttachFileOutlinedIcon fontSize="small" />
            <input
              ref={files.taskFileInputRef}
              type="file"
              hidden
              multiple
              onChange={files.handleTaskFilesSelected}
            />
          </IconButton>
        </Tooltip>
        <Tooltip title="Advanced settings">
          <IconButton
            size="small"
            color={hasAdvancedSettings ? 'primary' : 'default'}
            aria-label="Advanced task settings"
            onClick={(event) => setSettingsAnchor(event.currentTarget)}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {files.taskFileError && <Typography color="error">{files.taskFileError}</Typography>}
      {files.taskFiles.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {files.taskFiles.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              label={`${file.name} (${formatBytes(file.size)})`}
              onDelete={() => files.handleRemoveTaskFile(index)}
            />
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {Boolean(modelValue || reasoningEffortValue) && (
          <Chip
            label={`model: ${modelValue || 'default'}${reasoningEffortValue ? ` • effort: ${reasoningEffortValue}` : ''}`}
            onDelete={() =>
              formState.setTaskForm((prev) => ({
                ...prev,
                modelChoice: '',
                customModel: '',
                reasoningEffort: '',
                customReasoningEffort: ''
              }))
            }
          />
        )}
        {formState.taskForm.useHostDockerSocket && (
          <Chip
            label="docker: enabled"
            onDelete={() =>
              formState.setTaskForm((prev) => ({ ...prev, useHostDockerSocket: false }))
            }
          />
        )}
        {activeContextRepos.map((entry) => {
          const contextEnv = envs.find((env) => env.envId === entry.envId);
          const contextName = contextEnv
            ? formatRepoDisplay(contextEnv.repoUrl) || contextEnv.repoUrl
            : entry.envId;
          const contextRef = (entry.ref || '').trim() || contextEnv?.defaultBranch || 'main';
          return (
            <Chip
              key={`context-${entry.index}`}
              label={`repo: ${contextName} (${contextRef})`}
              onDelete={() => formState.handleRemoveContextRepo(entry.index)}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

export default TaskCreateBody;
