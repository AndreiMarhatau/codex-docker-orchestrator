import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { resolveModelValue, resolveReasoningEffortValue } from '../../model-helpers.js';
import { formatRepoDisplay } from '../../repo-helpers.js';
import TaskCreateBody from './form/TaskCreateBody.jsx';
import TaskCreatePopovers from './form/TaskCreatePopovers.jsx';

function TaskForm({ data, tasksState }) {
  const { envs, loading } = data;
  const { actions, files, formState } = tasksState;
  const [envMenuAnchor, setEnvMenuAnchor] = useState(null);
  const [refPopoverAnchor, setRefPopoverAnchor] = useState(null);
  const [settingsAnchor, setSettingsAnchor] = useState(null);

  useEffect(() => {
    if (!formState.showTaskForm) {
      setEnvMenuAnchor(null);
      setRefPopoverAnchor(null);
      setSettingsAnchor(null);
    }
  }, [formState.showTaskForm]);

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === formState.taskForm.envId) || null,
    [envs, formState.taskForm.envId]
  );
  const defaultRef = selectedEnv?.defaultBranch || 'main';
  const effectiveRef = formState.taskForm.ref.trim() || defaultRef;
  const hasCustomRef = formState.taskForm.ref.trim().length > 0;
  const modelValue = resolveModelValue(formState.taskForm.modelChoice, formState.taskForm.customModel);
  const reasoningEffortValue = resolveReasoningEffortValue(formState.taskForm);
  const hasAdvancedSettings =
    Boolean(modelValue) ||
    Boolean(reasoningEffortValue) ||
    formState.taskForm.useHostDockerSocket ||
    formState.taskForm.contextRepos.some((repo) => repo.envId);
  const envLabel = selectedEnv
    ? formatRepoDisplay(selectedEnv.repoUrl) || selectedEnv.repoUrl
    : 'Select environment';

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
          effectiveRef={effectiveRef}
          envLabel={envLabel}
          envs={envs}
          files={files}
          formState={formState}
          hasAdvancedSettings={hasAdvancedSettings}
          hasCustomRef={hasCustomRef}
          loading={loading}
          modelValue={modelValue}
          reasoningEffortValue={reasoningEffortValue}
          setEnvMenuAnchor={setEnvMenuAnchor}
          setRefPopoverAnchor={setRefPopoverAnchor}
          setSettingsAnchor={setSettingsAnchor}
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
          {files.taskFileUploading ? 'Uploading attachments...' : 'Run task'}
        </Button>
      </DialogActions>
      <TaskCreatePopovers
        defaultRef={defaultRef}
        envMenuAnchor={envMenuAnchor}
        envs={envs}
        formState={formState}
        loading={loading}
        refPopoverAnchor={refPopoverAnchor}
        setEnvMenuAnchor={setEnvMenuAnchor}
        setRefPopoverAnchor={setRefPopoverAnchor}
        setSettingsAnchor={setSettingsAnchor}
        settingsAnchor={settingsAnchor}
      />
    </Dialog>
  );
}

export default TaskForm;
