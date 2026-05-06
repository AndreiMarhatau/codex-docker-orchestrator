import { Stack, Typography } from '@mui/material';
import TaskDockerToggle from '../form/TaskDockerToggle.jsx';

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

      <TaskDockerToggle
        checked={detail.resumeRunAsGoal}
        disabled={dialogBusy}
        helperText="Codex will use this prompt as the goal objective."
        label="Run as goal"
        onChange={(event) => detail.setResumeRunAsGoal(event.target.checked)}
      />
    </Stack>
  );
}

export default TaskResumePromptFields;
