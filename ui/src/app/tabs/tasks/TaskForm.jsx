import { Button, Collapse, Divider, Stack, Typography } from '@mui/material';
import { MAX_TASK_FILES, MAX_TASK_IMAGES } from '../../constants.js';
import TaskFormAttachments from './form/TaskFormAttachments.jsx';
import TaskFormBasics from './form/TaskFormBasics.jsx';
import TaskFormContextRepos from './form/TaskFormContextRepos.jsx';
import TaskFormModel from './form/TaskFormModel.jsx';

function TaskForm({ data, envState, tasksState }) {
  const { envs, loading } = data;
  const { selectedEnv } = envState;
  const { actions, files, formState, images } = tasksState;

  return (
    <Collapse in={formState.showTaskForm} unmountOnExit>
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Divider />
        <Typography variant="subtitle2">New task</Typography>
        <TaskFormBasics
          envs={envs}
          selectedEnv={selectedEnv}
          taskForm={formState.taskForm}
          setTaskForm={formState.setTaskForm}
        />
        <Divider />
        <TaskFormModel
          handleTaskModelChoiceChange={formState.handleTaskModelChoiceChange}
          taskForm={formState.taskForm}
          setTaskForm={formState.setTaskForm}
        />
        <Divider />
        <TaskFormContextRepos envs={envs} formState={formState} loading={loading} />
        <Divider />
        <TaskFormAttachments
          files={files}
          images={images}
          loading={loading}
          maxFiles={MAX_TASK_FILES}
          maxImages={MAX_TASK_IMAGES}
        />
        <Button
          variant="contained"
          onClick={actions.handleCreateTask}
          disabled={
            loading ||
            files.taskFileUploading ||
            images.taskImageUploading ||
            !formState.taskForm.envId ||
            !formState.taskForm.prompt.trim()
          }
        >
          {images.taskImageUploading || files.taskFileUploading
            ? 'Uploading attachments...'
            : 'Run task'}
        </Button>
      </Stack>
    </Collapse>
  );
}

export default TaskForm;
