import { Box, Button, Stack, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import SectionHeader from '../../components/SectionHeader.jsx';

function TasksHeader({ tasksState }) {
  const { formState, hasActiveRuns, taskStats } = tasksState;

  return (
    <SectionHeader
      eyebrow="Delivery Console"
      icon={<BoltOutlinedIcon fontSize="small" />}
      title="Tasks"
      description="Track active work, inspect diffs, and move between prompt, output, and git state without losing the thread."
      actions={(
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => formState.setShowTaskForm(true)}
        >
          New task
        </Button>
      )}
      chips={[
        { label: hasActiveRuns ? 'Runs in progress' : 'No active runs', tone: hasActiveRuns ? 'live' : 'muted' },
        { label: `${taskStats.total} total`, tone: 'neutral' }
      ]}
    >
      <Box className="hero-stats">
        <Box className="stat-card">
          <Typography className="stat-label">Running now</Typography>
          <Typography className="stat-value">{taskStats.running}</Typography>
          <Typography className="stat-meta">
            Live tasks and tasks waiting to stop.
          </Typography>
        </Box>
        <Box className="stat-card">
          <Typography className="stat-label">Needs review</Typography>
          <Typography className="stat-value">{Math.max(taskStats.failed, 0)}</Typography>
          <Typography className="stat-meta">
            Failed or interrupted work that needs intervention.
          </Typography>
        </Box>
        <Box className="stat-card">
          <Typography className="stat-label">Queue health</Typography>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box component="span" className={`status-dot ${hasActiveRuns ? '' : 'is-idle'}`} />
            <Typography className="stat-value stat-value--inline">
              {hasActiveRuns ? 'Live' : 'Quiet'}
            </Typography>
          </Stack>
          <Typography className="stat-meta">
            {hasActiveRuns
              ? 'Streaming activity is flowing through the task board.'
              : 'No runs are currently streaming output.'}
          </Typography>
        </Box>
      </Box>
    </SectionHeader>
  );
}

export default TasksHeader;
