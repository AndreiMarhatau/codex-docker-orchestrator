import { Box, Stack, Typography } from '@mui/material';
import StatusIcon from '../../../../components/StatusIcon.jsx';
import { formatDuration, formatTimestamp } from '../../../../formatters.js';
import { buildTimeline, collectAgentMessages } from '../../../../log-helpers.js';
import { formatEffortDisplay, formatModelDisplay } from '../../../../model-helpers.js';
import { getElapsedMs } from '../../../../task-helpers.js';
import RunAgentMessages from './RunAgentMessages.jsx';
import RunArtifacts from './RunArtifacts.jsx';
import RunRequest from './RunRequest.jsx';

function RunLog({ now, run, taskId }) {
  const entries = run.entries || [];
  const agentMessages = collectAgentMessages(entries);
  const timeline = buildTimeline(entries);
  const artifacts = run.artifacts || [];
  const durationMs = getElapsedMs(run.startedAt, run.finishedAt, now);
  const runMetaItems = [
    durationMs !== null ? formatDuration(durationMs) : null,
    run.model ? `model ${formatModelDisplay(run.model)}` : null,
    run.reasoningEffort ? `effort ${formatEffortDisplay(run.reasoningEffort)}` : null,
    agentMessages.length > 0 ? `${agentMessages.length} messages` : null,
    artifacts.length > 0 ? `${artifacts.length} outputs` : null,
    entries.length > 0 ? `${entries.length} events` : null
  ].filter(Boolean);

  return (
    <Box className="run-shell">
      <Stack spacing={0.85} className="run-shell-header">
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2} className="run-shell-heading">
          <Typography className="run-card-title">{run.runId}</Typography>
          <Typography color="text.secondary" variant="body2">
            {formatTimestamp(run.startedAt)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" className="run-shell-meta">
          <Box component="span" className="run-status-pill">
            <StatusIcon status={run.status} size="small" />
            <span>{run.status}</span>
          </Box>
          <Box className="detail-meta-inline detail-meta-inline--compact">
            {runMetaItems.map((item) => (
              <span key={item} className="detail-meta-inline-item">{item}</span>
            ))}
          </Box>
        </Stack>
      </Stack>
      <Box className="run-reading-rail">
        <Stack spacing={0} className="run-card-body">
          <RunRequest run={run} />
          <RunAgentMessages timeline={timeline} runId={run.runId} />
          <RunArtifacts run={run} taskId={taskId} />
        </Stack>
      </Box>
    </Box>
  );
}

export default RunLog;
