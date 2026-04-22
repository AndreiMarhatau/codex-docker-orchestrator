import { Button, Stack, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

function TasksHeader({ compact = false, tasksState }) {
  const { formState } = tasksState;

  return (
    <Stack
      className={`tasks-page-header${compact ? ' tasks-page-header--compact' : ''}`}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
    >
      <Stack spacing={0.35}>
        <Typography component="h1" className="page-title">
          Tasks
        </Typography>
        <Typography className="page-subtitle">
          Manage and monitor your Codex agent tasks.
        </Typography>
      </Stack>
      <Button
        className="page-primary-button"
        variant="contained"
        startIcon={<AddOutlinedIcon />}
        onClick={() => formState.setShowTaskForm(true)}
        aria-label="New task"
      >
        New Task
      </Button>
    </Stack>
  );
}

export default TasksHeader;
