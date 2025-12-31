import { Stack, Typography } from '@mui/material';
import RunOverrideForm from './RunOverrideForm.jsx';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';

function TaskRunOverrides({ tasksState }) {
  const { detail, handleResumeModelChoiceChange } = tasksState;
  const { taskDetail } = detail;

  if (!taskDetail) {
    return null;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Run overrides</Typography>
      <Typography color="text.secondary" variant="body2">
        Default: model {formatModelDisplay(taskDetail.model)} · effort{' '}
        {formatEffortDisplay(taskDetail.reasoningEffort)}
      </Typography>
      <RunOverrideForm
        detail={detail}
        handleResumeModelChoiceChange={handleResumeModelChoiceChange}
      />
    </Stack>
  );
}

export default TaskRunOverrides;
