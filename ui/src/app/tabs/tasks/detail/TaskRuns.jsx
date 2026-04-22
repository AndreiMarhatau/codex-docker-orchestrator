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
    <Box className="detail-section detail-section--runs">
      <Stack spacing={1.1}>
        <Typography variant="h6" className="detail-section-title">Runs</Typography>
        {runLogs.map((run, index) => (
          <RunLog
            key={run.runId}
            now={now}
            run={run}
            runIndex={index}
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
