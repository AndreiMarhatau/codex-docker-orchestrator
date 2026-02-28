import {
  Checkbox,
  FormControlLabel,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TaskFormContextRepos from '../form/TaskFormContextRepos.jsx';
import RunOverrideForm from './RunOverrideForm.jsx';

function TaskResumeSettingsPopover({
  anchorEl,
  detail,
  envs,
  handleResumeModelChoiceChange,
  loading,
  onClose
}) {
  const resumeContextState = {
    handleAddContextRepo: detail.handleAddResumeContextRepo,
    handleContextRepoChange: detail.handleResumeContextRepoChange,
    handleRemoveContextRepo: detail.handleRemoveResumeContextRepo,
    taskForm: { contextRepos: detail.resumeContextRepos },
    usedContextEnvIds: detail.resumeUsedContextEnvIds
  };

  return (
    <Popover
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Stack spacing={2} sx={{ p: 2, width: { xs: 320, sm: 520 }, maxWidth: '90vw' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">Additional settings</Typography>
          <IconButton size="small" aria-label="Close settings" onClick={onClose}>
            <CloseOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <RunOverrideForm
          detail={detail}
          handleResumeModelChoiceChange={handleResumeModelChoiceChange}
        />
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
            label="Use host Docker socket"
          />
          <Tooltip title="Enables Docker via an isolated per-task sidecar daemon (not host Docker).">
            <WarningAmberIcon color="warning" fontSize="small" />
          </Tooltip>
        </Stack>
        <TaskFormContextRepos envs={envs} formState={resumeContextState} loading={loading} />
      </Stack>
    </Popover>
  );
}

export default TaskResumeSettingsPopover;
