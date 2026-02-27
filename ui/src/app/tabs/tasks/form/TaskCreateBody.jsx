import { Chip, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { MAX_TASK_FILES } from '../../../constants.js';
import { formatBytes } from '../../../formatters.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
const tagBaseSx = {
  height: 24,
  fontWeight: 600,
  borderRadius: '8px',
  '.MuiChip-label': {
    px: 1
  }
};

function PromptField({ files, formState, hasAdvancedSettings, loading, setSettingsAnchor }) {
  return (
    <TextField
      label="Task prompt"
      fullWidth
      multiline
      minRows={3}
      value={formState.taskForm.prompt}
      onChange={(event) =>
        formState.setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))
      }
      InputProps={{
        endAdornment: (
          <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 0.5 }}>
            <Stack direction="row" spacing={0.5}>
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
          </InputAdornment>
        )
      }}
    />
  );
}

function MainTags({ effectiveRef, envLabel, formState, hasCustomRef, setEnvMenuAnchor, setRefPopoverAnchor }) {
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      <Chip
        label={envLabel}
        size="small"
        onClick={(event) => setEnvMenuAnchor(event.currentTarget)}
        sx={{ ...tagBaseSx, bgcolor: '#dbeafe', color: '#1e3a8a' }}
      />
      <Chip
        label={effectiveRef}
        size="small"
        onClick={(event) => setRefPopoverAnchor(event.currentTarget)}
        onDelete={hasCustomRef ? () => formState.setTaskForm((prev) => ({ ...prev, ref: '' })) : undefined}
        sx={{ ...tagBaseSx, bgcolor: '#e0f2fe', color: '#0c4a6e' }}
      />
    </Stack>
  );
}

function OptionTags({ envs, formState, modelValue, reasoningEffortValue }) {
  const activeContextRepos = formState.taskForm.contextRepos
    .map((repo, index) => ({ ...repo, index }))
    .filter((repo) => repo.envId);

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {Boolean(modelValue || reasoningEffortValue) && (
        <Chip
          label={`${modelValue || 'default'}${reasoningEffortValue ? ` • ${reasoningEffortValue}` : ''}`}
          size="small"
          onDelete={() =>
            formState.setTaskForm((prev) => ({
              ...prev,
              modelChoice: '',
              customModel: '',
              reasoningEffort: '',
              customReasoningEffort: ''
            }))
          }
          sx={{ ...tagBaseSx, bgcolor: '#ede9fe', color: '#4c1d95' }}
        />
      )}
      {formState.taskForm.useHostDockerSocket && (
        <Chip
          label="docker"
          size="small"
          onDelete={() => formState.setTaskForm((prev) => ({ ...prev, useHostDockerSocket: false }))}
          sx={{ ...tagBaseSx, bgcolor: '#dcfce7', color: '#14532d' }}
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
            label={`${contextName} (${contextRef})`}
            size="small"
            onDelete={() => formState.handleRemoveContextRepo(entry.index)}
            sx={{ ...tagBaseSx, bgcolor: '#fef3c7', color: '#78350f' }}
          />
        );
      })}
    </Stack>
  );
}

function FileTags({ files }) {
  if (files.taskFiles.length === 0) {
    return null;
  }
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {files.taskFiles.map((file, index) => (
        <Chip
          key={`${file.name}-${index}`}
          label={`${file.name} (${formatBytes(file.size)})`}
          size="small"
          onDelete={() => files.handleRemoveTaskFile(index)}
          sx={{ ...tagBaseSx, bgcolor: '#e5e7eb', color: '#111827' }}
        />
      ))}
    </Stack>
  );
}
function TaskCreateBody(props) {
  const { effectiveRef, envLabel, envs, files, formState, hasAdvancedSettings, hasCustomRef, loading } = props;
  const { modelValue, reasoningEffortValue, setEnvMenuAnchor, setRefPopoverAnchor, setSettingsAnchor } = props;

  return (
    <Stack spacing={2} sx={{ mt: 0.5 }}>
      <PromptField
        files={files}
        formState={formState}
        hasAdvancedSettings={hasAdvancedSettings}
        loading={loading}
        setSettingsAnchor={setSettingsAnchor}
      />
      <MainTags
        effectiveRef={effectiveRef}
        envLabel={envLabel}
        formState={formState}
        hasCustomRef={hasCustomRef}
        setEnvMenuAnchor={setEnvMenuAnchor}
        setRefPopoverAnchor={setRefPopoverAnchor}
      />
      <OptionTags
        envs={envs}
        formState={formState}
        modelValue={modelValue}
        reasoningEffortValue={reasoningEffortValue}
      />
      {files.taskFileError && <Typography color="error">{files.taskFileError}</Typography>}
      <FileTags files={files} />
    </Stack>
  );
}

export default TaskCreateBody;
