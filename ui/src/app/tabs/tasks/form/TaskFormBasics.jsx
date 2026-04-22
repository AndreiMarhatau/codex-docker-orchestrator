import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { formatRepoDisplay } from '../../../repo-helpers.js';

function TaskFormBasics({ envs, selectedEnv, setTaskForm, taskForm }) {
  return (
    <Stack spacing={2.25}>
      <BoxField>
        <TextField
          select
          label="Environment"
          size="small"
          value={taskForm.envId}
          onChange={(event) => setTaskForm((prev) => ({ ...prev, envId: event.target.value }))}
          fullWidth
          className="task-compose-field"
        >
          {envs.map((env) => (
            <MenuItem key={env.envId} value={env.envId}>
              {formatRepoDisplay(env.repoUrl) || env.repoUrl}
            </MenuItem>
          ))}
        </TextField>
      </BoxField>

      <BoxField helperText="New branch will be created if it doesn't exist">
        <TextField
          label="Branch / tag / ref"
          size="small"
          fullWidth
          value={taskForm.ref}
          onChange={(event) => setTaskForm((prev) => ({ ...prev, ref: event.target.value }))}
          placeholder={`e.g. ${selectedEnv?.defaultBranch || 'main'} or v1.2.0`}
          className="task-compose-field"
        />
      </BoxField>

      <BoxField helperText="Be specific and include context, goals, and constraints.">
        <TextField
          label="Prompt"
          fullWidth
          multiline
          minRows={5}
          value={taskForm.prompt}
          onChange={(event) => setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))}
          placeholder="Describe what the agent should do..."
          className="task-compose-field"
        />
      </BoxField>
    </Stack>
  );
}

function BoxField({ children, helperText = '' }) {
  return (
    <Stack spacing={0.7}>
      {children}
      {helperText ? <Typography className="task-compose-helper">{helperText}</Typography> : null}
    </Stack>
  );
}

export default TaskFormBasics;
