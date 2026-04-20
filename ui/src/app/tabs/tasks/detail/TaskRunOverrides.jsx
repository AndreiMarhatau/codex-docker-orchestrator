import { Stack, Typography } from '@mui/material';
import RunOverrideForm from './RunOverrideForm.jsx';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';
import DisclosureSection from '../../../components/DisclosureSection.jsx';

function TaskRunOverrides({ tasksState }) {
  const { detail, handleResumeModelChoiceChange } = tasksState;
  const { taskDetail } = detail;

  if (!taskDetail) {
    return null;
  }

  return (
    <DisclosureSection
      className="detail-meta-panel detail-meta-panel--sticky"
      title="Run defaults"
      meta={`model ${formatModelDisplay(taskDetail.model)} · ${formatEffortDisplay(taskDetail.reasoningEffort)}`}
    >
      <Stack spacing={1.25}>
        <Typography color="text.secondary" variant="body2">
          Adjust the defaults used when you continue this task.
        </Typography>
        <RunOverrideForm
          detail={detail}
          handleResumeModelChoiceChange={handleResumeModelChoiceChange}
        />
      </Stack>
    </DisclosureSection>
  );
}

export default TaskRunOverrides;
