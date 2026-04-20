import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Stack,
  Typography
} from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import UploadProgress from '../../../components/UploadProgress.jsx';
import { MAX_TASK_FILES } from '../../../constants.js';
import { formatBytes } from '../../../formatters.js';
import TaskFormBasics from './TaskFormBasics.jsx';
import TaskFormContextRepos from './TaskFormContextRepos.jsx';
import TaskFormModel from './TaskFormModel.jsx';

const tagBaseSx = {
  height: 24,
  fontWeight: 600,
  borderRadius: '8px',
  '.MuiChip-label': {
    px: 1
  },
  '.MuiChip-deleteIcon': {
    color: 'inherit',
    opacity: 0.92
  },
  '.MuiChip-deleteIcon:hover': {
    color: 'inherit',
    opacity: 1
  }
};

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

function AdvancedSummary({ formState, hasAdvancedSettings, modelValue, reasoningEffortValue }) {
  const contextCount = formState.taskForm.contextRepos.filter((repo) => repo.envId).length;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.25}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      sx={{ width: '100%', pr: 1 }}
    >
      <Stack spacing={0.35}>
        <Typography variant="subtitle2">Advanced task settings</Typography>
        <Typography color="text.secondary" variant="body2">
          Model, reasoning effort, Docker access, and read-only reference repos.
        </Typography>
      </Stack>
      {hasAdvancedSettings && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {modelValue && <Chip size="small" label={modelValue} variant="outlined" />}
          {reasoningEffortValue && (
            <Chip size="small" label={`effort ${reasoningEffortValue}`} variant="outlined" />
          )}
          {formState.taskForm.useHostDockerSocket && (
            <Chip size="small" label="docker enabled" variant="outlined" />
          )}
          {contextCount > 0 && (
            <Chip size="small" label={`${contextCount} refs`} variant="outlined" />
          )}
        </Stack>
      )}
    </Stack>
  );
}

function TaskCreateBody(props) {
  const {
    envs,
    files,
    formState,
    hasAdvancedSettings,
    loading,
    modelValue,
    selectedEnv,
    reasoningEffortValue,
    setShowAdvancedSettings,
    showAdvancedSettings
  } = props;

  return (
    <Stack spacing={2.25} sx={{ mt: 0.5 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">Primary repo</Typography>
        <Typography color="text.secondary" variant="body2">
          Pick the working environment, confirm the target ref, then write the task request.
        </Typography>
        <TaskFormBasics
          envs={envs}
          selectedEnv={selectedEnv}
          setTaskForm={formState.setTaskForm}
          taskForm={formState.taskForm}
        />
      </Stack>

      <Box className="subpanel-card">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Stack spacing={0.35}>
            <Typography variant="subtitle2">Attachments</Typography>
            <Typography color="text.secondary" variant="body2">
              Add briefs, screenshots, or notes so the task starts with the right context.
            </Typography>
          </Stack>
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={<AttachFileOutlinedIcon />}
            disabled={loading || files.taskFileUploading || files.taskFiles.length >= MAX_TASK_FILES}
          >
            Add attachments
            <input
              ref={files.taskFileInputRef}
              type="file"
              hidden
              multiple
              onChange={files.handleTaskFilesSelected}
            />
          </Button>
        </Stack>
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          {files.taskFileError && <Typography color="error">{files.taskFileError}</Typography>}
          <UploadProgress progress={files.taskFileUploadProgress} />
          <FileTags files={files} />
          {files.taskFiles.length === 0 && (
            <Typography color="text.secondary" variant="body2">
              Up to {MAX_TASK_FILES} files can be attached to a task.
            </Typography>
          )}
        </Stack>
      </Box>

      <Accordion
        expanded={showAdvancedSettings}
        onChange={(_event, expanded) => setShowAdvancedSettings(expanded)}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreOutlinedIcon />}
          aria-label="Advanced task settings"
        >
          <AdvancedSummary
            formState={formState}
            hasAdvancedSettings={hasAdvancedSettings}
            modelValue={modelValue}
            reasoningEffortValue={reasoningEffortValue}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2.25}>
            <TaskFormModel
              handleTaskModelChoiceChange={formState.handleTaskModelChoiceChange}
              setTaskForm={formState.setTaskForm}
              taskForm={formState.taskForm}
            />
            <TaskFormContextRepos envs={envs} formState={formState} loading={loading} />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

export default TaskCreateBody;
