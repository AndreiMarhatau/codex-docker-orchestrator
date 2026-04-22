import { Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { formatRepoDisplay } from '../../../repo-helpers.js';

function TaskFormContextRepos({ envs, formState, loading }) {
  const canAddContextRepo = formState.usedContextEnvIds.length < envs.length;
  const contextRepos = formState.taskForm.contextRepos;

  return (
    <Stack spacing={1.1}>
      {contextRepos.length === 0 && (
        <BoxPlaceholder
          label="No additional repositories"
          action={canAddContextRepo ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddOutlinedIcon fontSize="small" />}
              onClick={formState.handleAddContextRepo}
              disabled={loading}
            >
              Add repository
            </Button>
          ) : null}
        />
      )}

      {contextRepos.map((entry, index) => {
        const selectedContextEnv = envs.find((env) => env.envId === entry.envId);
        const branchDefault = (selectedContextEnv?.defaultBranch || 'main').trim();

        return (
          <Stack key={`context-repo-${index}`} spacing={1.1} className="task-compose-nested-panel">
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Stack spacing={1} sx={{ flex: 1 }}>
                <TextField
                  select
                  size="small"
                  label="Environment"
                  value={entry.envId}
                  onChange={(event) => formState.handleContextRepoChange(index, 'envId', event.target.value)}
                  disabled={loading}
                  className="task-compose-field"
                >
                  {envs.map((env) => (
                    <MenuItem
                      key={env.envId}
                      value={env.envId}
                      disabled={
                        formState.usedContextEnvIds.includes(env.envId) && env.envId !== entry.envId
                      }
                    >
                      {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="Branch / tag / ref"
                  value={entry.ref}
                  onChange={(event) =>
                    formState.handleContextRepoChange(index, 'ref', event.target.value)
                  }
                  placeholder={branchDefault}
                  className="task-compose-field"
                />
              </Stack>
              <IconButton
                size="small"
                onClick={() => formState.handleRemoveContextRepo(index)}
                aria-label="Remove reference repo"
                disabled={loading}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        );
      })}

      {contextRepos.length > 0 && canAddContextRepo && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddOutlinedIcon fontSize="small" />}
          onClick={formState.handleAddContextRepo}
          disabled={loading}
          sx={{ alignSelf: 'flex-start' }}
        >
          Add repository
        </Button>
      )}
    </Stack>
  );
}

function BoxPlaceholder({ action = null, label }) {
  return (
    <Stack spacing={1.15} className="task-compose-repo-placeholder">
      <Typography color="text.secondary">{label}</Typography>
      {action}
    </Stack>
  );
}

export default TaskFormContextRepos;
