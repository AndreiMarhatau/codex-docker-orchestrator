import { Stack, Typography } from '@mui/material';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';
import DisclosureSection from '../../../components/DisclosureSection.jsx';
import TaskDetailCollections from './TaskDetailCollections.jsx';

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function TaskRunOverrides({ tasksState }) {
  const { detail } = tasksState;
  const { taskDetail } = detail;

  if (!taskDetail) {
    return null;
  }

  const attachmentCount = (taskDetail.attachments || []).length;
  const contextRepoCount = (taskDetail.contextRepos || []).length;
  const outputCount = (taskDetail.runLogs || []).reduce(
    (count, run) => count + (run.artifacts || []).length,
    0
  );
  const hasContext = attachmentCount > 0 || contextRepoCount > 0 || outputCount > 0;

  if (!hasContext) {
    return null;
  }

  return (
    <Stack spacing={1} className="task-detail-secondary">
      <DisclosureSection
        className="detail-disclosure detail-disclosure--context"
        title={(
          <span className="detail-inline-title">
            <span>Task context</span>
            <span className="detail-inline-count">
              {`${formatCount(outputCount, 'output')} · ${formatCount(attachmentCount, 'file')} · ${formatCount(contextRepoCount, 'repo')}`}
            </span>
          </span>
        )}
      >
        <Stack spacing={1.25}>
          <Typography color="text.secondary" variant="body2">
            {`Defaults: ${formatModelDisplay(taskDetail.model)} · ${formatEffortDisplay(taskDetail.reasoningEffort)}`}
          </Typography>
          <TaskDetailCollections taskDetail={taskDetail} />
        </Stack>
      </DisclosureSection>
    </Stack>
  );
}

export default TaskRunOverrides;
