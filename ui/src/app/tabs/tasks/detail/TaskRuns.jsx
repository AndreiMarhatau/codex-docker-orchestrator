import { Stack, Typography } from '@mui/material';
import RunLog from './runs/RunLog.jsx';

function TaskRuns({ tasksState }) {
  const { detail, now } = tasksState;
  const runLogs = detail.taskDetail.runLogs || [];

  return (
    <>
      <Typography variant="subtitle2">Runs</Typography>
      <Stack spacing={1}>
        {runLogs.map((run) => (
          <RunLog key={run.runId} now={now} run={run} taskId={detail.taskDetail.taskId} />
        ))}
        {runLogs.length === 0 && (
          <Typography color="text.secondary">No logs yet.</Typography>
        )}
      </Stack>
    </>
  );
}

export default TaskRuns;
