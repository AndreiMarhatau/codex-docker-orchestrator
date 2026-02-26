import { Box, Chip, Stack, Typography } from '@mui/material';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';

function TasksHeader({ tasksState }) {
  const { hasActiveRuns, taskStats } = tasksState;

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <BoltOutlinedIcon color="primary" />
          <Typography variant="h6" className="panel-title">
            Tasks
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span" className={`status-dot ${hasActiveRuns ? '' : 'is-idle'}`} />
          <Typography variant="subtitle2">
            {hasActiveRuns ? 'Runs in progress' : 'No active runs'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`${taskStats.total} total`} size="small" />
          <Chip label={`${taskStats.running} running`} size="small" />
          <Chip label={`${taskStats.failed} failed`} size="small" />
        </Stack>
      </Stack>
    </Stack>
  );
}

export default TasksHeader;
