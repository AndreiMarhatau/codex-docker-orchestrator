import { MenuItem, TextField } from '@mui/material';
import { formatRepoDisplay } from '../../../repo-helpers.js';

function TaskFormBasics({ envs, selectedEnv, setTaskForm, taskForm }) {
  return (
    <>
      <TextField
        select
        label="Environment"
        value={taskForm.envId}
        onChange={(event) => setTaskForm((prev) => ({ ...prev, envId: event.target.value }))}
        fullWidth
      >
        {envs.map((env) => (
          <MenuItem key={env.envId} value={env.envId}>
            {formatRepoDisplay(env.repoUrl) || env.repoUrl}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Branch / tag / ref"
        fullWidth
        value={taskForm.ref}
        onChange={(event) => setTaskForm((prev) => ({ ...prev, ref: event.target.value }))}
        placeholder={selectedEnv?.defaultBranch || 'main'}
      />
      <TextField
        label="Task prompt"
        fullWidth
        multiline
        minRows={3}
        value={taskForm.prompt}
        onChange={(event) => setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))}
      />
    </>
  );
}

export default TaskFormBasics;
