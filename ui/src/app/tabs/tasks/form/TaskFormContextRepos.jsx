import { IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { emptyContextRepo } from '../../../constants.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';

function TaskFormContextRepos({ envs, formState, loading }) {
  const canAddContextRepo = formState.usedContextEnvIds.length < envs.length;
  const displayedContextRepos = [...formState.taskForm.contextRepos];
  const shouldShowEmptyContextRepo =
    canAddContextRepo &&
    (displayedContextRepos.length === 0 ||
      Boolean(displayedContextRepos[displayedContextRepos.length - 1].envId));
  if (shouldShowEmptyContextRepo) {
    displayedContextRepos.push(emptyContextRepo);
  }

  function handleContextEnvChange(index, event) {
    const nextEnvId = event.target.value;
    formState.handleContextRepoChange(index, 'envId', nextEnvId);
  }

  return (
    <>
      <Typography variant="subtitle2">Reference repos (read-only)</Typography>
      <Stack spacing={1}>
        <Typography color="text.secondary">Attach existing environments as read-only context.</Typography>
        {!formState.taskForm.contextRepos.length && displayedContextRepos.length === 0 && (
          <Typography color="text.secondary">No reference repos attached.</Typography>
        )}
        {displayedContextRepos.map((entry, index) => {
          const selectedContextEnv = envs.find((env) => env.envId === entry.envId);
          const isPlaceholder = !entry.envId && index >= formState.taskForm.contextRepos.length;
          const branchDefault = (selectedContextEnv?.defaultBranch || 'main').trim();
          return (
            <Stack
              key={`context-repo-${index}`}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems="center"
            >
              <TextField
                select
                size="small"
                label="Environment"
                value={entry.envId}
                onChange={(event) => handleContextEnvChange(index, event)}
                disabled={loading}
                sx={{ minWidth: 220, flex: 1 }}
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
              {entry.envId && (
                <TextField
                  size="small"
                  label="Branch / tag / ref"
                  value={entry.ref}
                  onChange={(event) =>
                    formState.handleContextRepoChange(index, 'ref', event.target.value)
                  }
                  onBlur={() => {
                    if (!entry.ref.trim()) {
                      formState.handleContextRepoChange(index, 'ref', branchDefault);
                    }
                  }}
                  placeholder={branchDefault}
                  sx={{ flex: 1 }}
                />
              )}
              {!isPlaceholder && (
                <IconButton
                  size="small"
                  onClick={() => formState.handleRemoveContextRepo(index)}
                  aria-label="Remove reference repo"
                  disabled={loading}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          );
        })}
      </Stack>
    </>
  );
}

export default TaskFormContextRepos;
