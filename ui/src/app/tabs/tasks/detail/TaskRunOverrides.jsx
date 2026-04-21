import { Stack, Typography } from '@mui/material';
import RunOverrideForm from './RunOverrideForm.jsx';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';
import DisclosureSection from '../../../components/DisclosureSection.jsx';
import TaskDetailCollections from './TaskDetailCollections.jsx';

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function TaskRunOverrides({ tasksState }) {
  const { detail, handleResumeModelChoiceChange } = tasksState;
  const { taskDetail } = detail;

  if (!taskDetail) {
    return null;
  }

  const hasRunLogs = (taskDetail.runLogs || []).length > 0;
  const attachmentCount = (taskDetail.attachments || []).length;
  const contextRepoCount = (taskDetail.contextRepos || []).length;
  const outputCount = (taskDetail.runLogs || []).reduce(
    (count, run) => count + (run.artifacts || []).length,
    0
  );

  return (
    <Stack spacing={1} className="task-detail-secondary">
      <DisclosureSection
        className="detail-meta-panel detail-disclosure"
        title={(
          <span className="detail-inline-title">
            <span>Task context</span>
            <span className="detail-inline-count">
              {`${formatCount(outputCount, 'output')} · ${formatCount(attachmentCount, 'file')} · ${formatCount(contextRepoCount, 'repo')}`}
            </span>
          </span>
        )}
      >
        <Stack spacing={1.5}>
          <Stack spacing={0.35}>
            <Typography variant="subtitle2">Run defaults</Typography>
            <Typography className="detail-inline-summary" color="text.secondary" variant="body2">
              {`model ${formatModelDisplay(taskDetail.model)} · effort ${formatEffortDisplay(taskDetail.reasoningEffort)}`}
            </Typography>
          </Stack>
          <Typography color="text.secondary" variant="body2">
            Adjust the defaults used when you continue this task.
          </Typography>
          <RunOverrideForm
            detail={detail}
            handleResumeModelChoiceChange={handleResumeModelChoiceChange}
          />
          <TaskDetailCollections
            taskDetail={taskDetail}
            includeTaskFiles={hasRunLogs}
            includeReferenceRepos={hasRunLogs}
            includeOutputs={hasRunLogs}
          />
        </Stack>
      </DisclosureSection>
    </Stack>
  );
}

export default TaskRunOverrides;
