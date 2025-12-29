import { Stack } from '@mui/material';
import { collectAgentMessages } from '../../../../log-helpers.js';
import RunAgentMessages from './RunAgentMessages.jsx';
import RunArtifacts from './RunArtifacts.jsx';
import RunEntries from './RunEntries.jsx';
import RunRequest from './RunRequest.jsx';

function RunLog({ now, run, taskId }) {
  const entries = run.entries || [];
  const agentMessages = collectAgentMessages(entries);

  return (
    <Stack spacing={1}>
      <RunRequest run={run} />
      <RunEntries entries={entries} now={now} run={run} />
      <RunArtifacts run={run} taskId={taskId} />
      {agentMessages && <RunAgentMessages agentMessages={agentMessages} runId={run.runId} />}
    </Stack>
  );
}

export default RunLog;
