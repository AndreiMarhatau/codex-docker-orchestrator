import { Stack, Typography } from '@mui/material';
import TaskGoalField from '../form/TaskGoalField.jsx';

function TaskResumePromptFields({ detail, dialogBusy }) {
  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.7}>
        <Typography className="task-compose-helper">
          Continuing <strong>{detail.taskDetail?.branchName || 'current branch'}</strong>
        </Typography>
        <textarea
          className="task-compose-textarea"
          value={detail.resumePrompt}
          onChange={(event) => detail.setResumePrompt(event.target.value)}
          disabled={dialogBusy}
          placeholder="Describe what the agent should do..."
          rows={8}
          aria-label="Continuation prompt"
        />
        <Typography className="task-compose-helper">
          Be specific and include context and constraints.
        </Typography>
      </Stack>

      <Stack spacing={0.7}>
        <TaskGoalField
          disabled={dialogBusy}
          value={detail.resumeGoalObjective}
          onChange={detail.setResumeGoalObjective}
        />
        <Typography className="task-compose-helper">
          Optional. Clear this field to clear the current goal.
        </Typography>
      </Stack>
    </Stack>
  );
}

export default TaskResumePromptFields;
