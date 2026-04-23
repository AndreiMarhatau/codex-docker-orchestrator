import { Button, Stack, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';

function TasksHeader({ compact = false, tasksState }) {
  const { formState } = tasksState;

  return (
    <Stack
      className={`tasks-page-header${compact ? ' tasks-page-header--compact' : ''}`}
      direction="row"
      spacing={2}
      justifyContent="space-between"
      alignItems="center"
    >
      <Typography component="h1" className="page-title">
        Tasks
      </Typography>
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
