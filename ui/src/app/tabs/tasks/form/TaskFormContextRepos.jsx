import { Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { formatRepoDisplay } from '../../../repo-helpers.js';

function TaskFormContextRepos({ envs, formState, loading }) {
  return (
    <>
      <Typography variant="subtitle2">Reference repos (read-only)</Typography>
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddOutlinedIcon />}
            onClick={formState.handleAddContextRepo}
            disabled={
              loading || envs.length === 0 || formState.usedContextEnvIds.length >= envs.length
            }
          >
            Add reference repo
          </Button>
          <Typography color="text.secondary">
            Attach existing environments as read-only context.
          </Typography>
        </Stack>
        {formState.taskForm.contextRepos.length === 0 && (
          <Typography color="text.secondary">No reference repos attached.</Typography>
        )}
        {formState.taskForm.contextRepos.map((entry, index) => {
          const selectedContextEnv = envs.find((env) => env.envId === entry.envId);
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
                onChange={(event) =>
                  formState.handleContextRepoChange(index, 'envId', event.target.value)
                }
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
              <TextField
                size="small"
                label="Branch / tag / ref"
                value={entry.ref}
                onChange={(event) =>
                  formState.handleContextRepoChange(index, 'ref', event.target.value)
                }
                placeholder={selectedContextEnv?.defaultBranch || 'main'}
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => formState.handleRemoveContextRepo(index)}
                aria-label="Remove reference repo"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        })}
      </Stack>
    </>
  );
}

export default TaskFormContextRepos;
