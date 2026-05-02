import { Alert, AlertTitle, Typography } from '@mui/material';

function goalStatusLabel(status) {
  switch (status) {
    case 'active':
      return 'Pursuing goal';
    case 'complete':
      return 'Goal complete';
    default:
      return 'Goal status';
  }
}

function TaskGoalAlert({ taskDetail }) {
  const goal = taskDetail.goal;
  if (!goal) {
    return null;
  }

  return (
    <Alert severity={goal.status === 'complete' ? 'success' : 'info'} variant="outlined">
      <AlertTitle>{goalStatusLabel(goal.status)}</AlertTitle>
      <Typography component="span">{goal.objective}</Typography>
    </Alert>
  );
}

export default TaskGoalAlert;
