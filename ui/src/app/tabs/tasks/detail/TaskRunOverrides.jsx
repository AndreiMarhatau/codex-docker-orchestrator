import { Box, Stack, Typography } from '@mui/material';
import RunOverrideForm from './RunOverrideForm.jsx';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';

function TaskRunOverrides({ tasksState }) {
  const { detail, handleResumeModelChoiceChange } = tasksState;
  const { taskDetail } = detail;

  if (!taskDetail) {
    return null;
  }

  return (
    <Box component="details" className="detail-meta-panel">
      <summary className="log-summary">
        <span>Run overrides</span>
        <span className="log-meta">
          {`model ${formatModelDisplay(taskDetail.model)} · ${formatEffortDisplay(taskDetail.reasoningEffort)}`}
        </span>
      </summary>
      <Stack spacing={1.25} sx={{ mt: 1.25 }}>
        <Typography color="text.secondary" variant="body2">
          Adjust the defaults used when you continue this task.
        </Typography>
        <RunOverrideForm
          detail={detail}
          handleResumeModelChoiceChange={handleResumeModelChoiceChange}
        />
      </Stack>
    </Box>
  );
}

export default TaskRunOverrides;
