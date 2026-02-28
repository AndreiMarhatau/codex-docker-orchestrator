import { Button, IconButton, Menu, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import TaskFormContextRepos from './TaskFormContextRepos.jsx';
import TaskFormModel from './TaskFormModel.jsx';

function TaskCreatePopovers({
  defaultRef,
  envMenuAnchor,
  envs,
  formState,
  loading,
  refPopoverAnchor,
  setEnvMenuAnchor,
  setRefPopoverAnchor,
  setSettingsAnchor,
  settingsAnchor
}) {
  return (
    <>
      <Menu
        anchorEl={envMenuAnchor}
        open={Boolean(envMenuAnchor)}
        onClose={() => setEnvMenuAnchor(null)}
      >
        {envs.map((env) => (
          <MenuItem
            key={env.envId}
            selected={env.envId === formState.taskForm.envId}
            onClick={() => {
              formState.setTaskForm((prev) => ({ ...prev, envId: env.envId }));
              setEnvMenuAnchor(null);
            }}
          >
            {formatRepoDisplay(env.repoUrl) || env.repoUrl}
          </MenuItem>
        ))}
      </Menu>

      <Popover
        anchorEl={refPopoverAnchor}
        open={Boolean(refPopoverAnchor)}
        onClose={() => setRefPopoverAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={1.25} sx={{ p: 2, width: 320 }}>
          <TextField
            label="Branch / tag / ref"
            size="small"
            value={formState.taskForm.ref}
            onChange={(event) =>
              formState.setTaskForm((prev) => ({ ...prev, ref: event.target.value }))
            }
            placeholder={defaultRef}
          />
          <Button
            size="small"
            onClick={() => formState.setTaskForm((prev) => ({ ...prev, ref: '' }))}
          >
            Use default ({defaultRef})
          </Button>
        </Stack>
      </Popover>

      <Popover
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={2} sx={{ p: 2, width: { xs: 320, sm: 520 }, maxWidth: '90vw' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">Additional settings</Typography>
            <IconButton size="small" aria-label="Close settings" onClick={() => setSettingsAnchor(null)}>
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <TaskFormModel
            handleTaskModelChoiceChange={formState.handleTaskModelChoiceChange}
            taskForm={formState.taskForm}
            setTaskForm={formState.setTaskForm}
          />
          <TaskFormContextRepos envs={envs} formState={formState} loading={loading} />
        </Stack>
      </Popover>
    </>
  );
}

export default TaskCreatePopovers;
