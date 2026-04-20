import { Box, Chip, Stack, Typography } from '@mui/material';
import StatusIcon from '../../../../components/StatusIcon.jsx';
import { formatDuration, formatTimestamp } from '../../../../formatters.js';
import { collectAgentMessages } from '../../../../log-helpers.js';
import { getElapsedMs } from '../../../../task-helpers.js';
import RunAgentMessages from './RunAgentMessages.jsx';
import RunArtifacts from './RunArtifacts.jsx';
import RunEntries from './RunEntries.jsx';
import RunRequest from './RunRequest.jsx';

function RunLog({ emptyEntriesMessage, now, run, taskId }) {
  const entries = run.entries || [];
  const agentMessages = collectAgentMessages(entries);
  const artifacts = run.artifacts || [];
  const durationMs = getElapsedMs(run.startedAt, run.finishedAt, now);

  return (
    <Box component="details" className="run-card" open>
      <summary className="run-card-summary">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Stack spacing={0.35}>
            <Typography className="run-card-title">{run.runId}</Typography>
            <Typography color="text.secondary" variant="body2">
              {formatTimestamp(run.startedAt)}
            </Typography>
          </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Box component="span" className="run-status-pill">
            <StatusIcon status={run.status} size="small" />
            <span>{run.status}</span>
          </Box>
          {durationMs !== null && (
            <Chip size="small" variant="outlined" label={formatDuration(durationMs)} />
          )}
          {agentMessages.length > 0 && (
            <Chip size="small" variant="outlined" label={`${agentMessages.length} messages`} />
          )}
          {artifacts.length > 0 && (
            <Chip size="small" variant="outlined" label={`${artifacts.length} outputs`} />
          )}
          {entries.length > 0 && (
            <Chip size="small" variant="outlined" label={`${entries.length} events`} />
          )}
        </Stack>
      </Stack>
      </summary>
      <Stack spacing={1.25} className="run-card-body">
        {agentMessages.length > 0 && (
          <RunAgentMessages agentMessages={agentMessages} runId={run.runId} />
        )}
        <RunArtifacts run={run} taskId={taskId} />
        <RunRequest run={run} />
        <RunEntries entries={entries} emptyEntriesMessage={emptyEntriesMessage} />
      </Stack>
    </Box>
  );
}

export default RunLog;
