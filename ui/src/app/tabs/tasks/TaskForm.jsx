import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { resolveModelValue, resolveReasoningEffortValue } from '../../model-helpers.js';
import TaskCreateBody from './form/TaskCreateBody.jsx';

function TaskForm({ data, tasksState }) {
  const { envs, loading } = data;
  const { actions, files, formState } = tasksState;
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  useEffect(() => {
    if (!formState.showTaskForm) {
      setShowAdvancedSettings(false);
    }
  }, [formState.showTaskForm]);

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === formState.taskForm.envId) || null,
    [envs, formState.taskForm.envId]
  );
  const modelValue = resolveModelValue(formState.taskForm.modelChoice, formState.taskForm.customModel);
  const reasoningEffortValue = resolveReasoningEffortValue(formState.taskForm);
  const hasAdvancedSettings =
    Boolean(modelValue) ||
    Boolean(reasoningEffortValue) ||
    formState.taskForm.useHostDockerSocket ||
    formState.taskForm.contextRepos.some((repo) => repo.envId);
  const uploadPercent = Math.max(
    0,
    Math.min(100, Math.round(files.taskFileUploadProgress?.percent || 0))
  );

  useEffect(() => {
    if (formState.showTaskForm && hasAdvancedSettings) {
      setShowAdvancedSettings(true);
    }
  }, [formState.showTaskForm, hasAdvancedSettings]);

  return (
    <Dialog
      open={formState.showTaskForm}
      onClose={() => formState.setShowTaskForm(false)}
      fullWidth
      maxWidth="md"
      aria-label="New task"
    >
      <DialogTitle>New task</DialogTitle>
      <DialogContent>
        <TaskCreateBody
          envs={envs}
          files={files}
          formState={formState}
          hasAdvancedSettings={hasAdvancedSettings}
          loading={loading}
          modelValue={modelValue}
          selectedEnv={selectedEnv}
          reasoningEffortValue={reasoningEffortValue}
          setShowAdvancedSettings={setShowAdvancedSettings}
          showAdvancedSettings={showAdvancedSettings}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => formState.setShowTaskForm(false)}>Cancel</Button>
        <Button
          variant="contained"
          onClick={actions.handleCreateTask}
          disabled={
            loading ||
            files.taskFileUploading ||
            !formState.taskForm.envId ||
            !formState.taskForm.prompt.trim()
          }
        >
          {files.taskFileUploading ? `Uploading attachments... ${uploadPercent}%` : 'Run task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskForm;
