import { Box, Stack, Typography } from '@mui/material';
import RunLog from './runs/RunLog.jsx';

function TaskRuns({ tasksState }) {
  const { detail, now } = tasksState;
  const taskDetail = detail.taskDetail;
  const runLogs = taskDetail.runLogs || [];
  const latestRunLog = runLogs[runLogs.length - 1] || null;
  const latestRunFailedBeforeSpawn =
    taskDetail.status === 'failed' && latestRunLog?.failedBeforeSpawn === true;

  return (
    <Box className="detail-section">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="subtitle2">Runs</Typography>
        <Typography color="text.secondary" variant="body2">
          {runLogs.length} {runLogs.length === 1 ? 'run' : 'runs'}
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {runLogs.map((run) => (
          <RunLog
            key={run.runId}
            emptyEntriesMessage={
              run.failedBeforeSpawn === true
                ? 'Run logs are unavailable because startup failed before codex-docker was spawned.'
                : undefined
            }
            now={now}
            run={run}
            taskId={detail.taskDetail.taskId}
          />
        ))}
        {runLogs.length === 0 && !latestRunFailedBeforeSpawn && (
          <Typography color="text.secondary">No logs yet.</Typography>
        )}
        {runLogs.length === 0 && latestRunFailedBeforeSpawn && (
          <Typography color="text.secondary">
            Run logs are unavailable because startup failed before codex-docker was spawned.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default TaskRuns;
