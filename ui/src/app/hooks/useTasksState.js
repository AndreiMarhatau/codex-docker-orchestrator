import { useEffect, useMemo } from 'react';
import { MODEL_CUSTOM_VALUE } from '../constants.js';
import { getGitStatusDisplay } from '../git-helpers.js';
import { getEffortOptionsForModel } from '../model-helpers.js';
import { readTaskIdQuery } from '../query-state.js';
import useNow from './useNow.js';
import useTaskActions from './useTaskActions.js';
import useTaskDetail from './useTaskDetail.js';
import useTaskFormState from './useTaskFormState.js';
import useTaskFiles from './useTaskFiles.js';
import useTaskSelection from './useTaskSelection.js';

const ACTIVE_TASK_STATUSES = new Set(['running', 'reviewing', 'pushing', 'stopping']);

function isActiveTaskStatus(status) {
  return ACTIVE_TASK_STATUSES.has(status);
}

function useTasksState({ enabled, envs, refreshAll, setError, setLoading, tasks }) {
  const selection = useTaskSelection();
  const formState = useTaskFormState({
    envs,
    selectedTaskId: selection.selectedTaskId,
    tasks
  });
  const files = useTaskFiles();
  const detail = useTaskDetail({
    enabled,
    envs,
    selectedTaskId: selection.selectedTaskId,
    setError,
    setSelectedTaskId: selection.setSelectedTaskId,
    tasks
  });

  function handleResumeModelChoiceChange(value) {
    detail.setResumeConfig((prev) => {
      const next = { ...prev, modelChoice: value };
      if (!value) {
        next.reasoningEffort = '';
        return next;
      }
      if (value !== MODEL_CUSTOM_VALUE) {
        const supportedEfforts = getEffortOptionsForModel(value);
        if (next.reasoningEffort && !supportedEfforts.includes(next.reasoningEffort)) {
          next.reasoningEffort = '';
        }
      }
      return next;
    });
  }

  const actions = useTaskActions({
    refreshAll,
    refreshTaskDetail: detail.refreshTaskDetail,
    resumeAttachmentRemovals: detail.resumeAttachmentRemovals,
    resumeConfig: detail.resumeConfig,
    resumeContextRepos: detail.resumeContextRepos,
    resumeContextTouched: detail.resumeContextTouched,
    resumeFiles: detail.resumeFiles,
    resumePrompt: detail.resumePrompt,
    resumeRunAsGoal: detail.resumeRunAsGoal,
    resumeUseHostDockerSocket: detail.resumeUseHostDockerSocket,
    selectedTaskId: selection.selectedTaskId,
    setSelectedTaskId: selection.setSelectedTaskId,
    setError,
    setLoading,
    setResumeAttachmentRemovals: detail.setResumeAttachmentRemovals,
    setResumeConfig: detail.setResumeConfig,
    setResumeContextRepos: detail.setResumeContextRepos,
    setResumeContextTouched: detail.setResumeContextTouched,
    setResumeDockerTouched: detail.setResumeDockerTouched,
    setResumePrompt: detail.setResumePrompt,
    setResumeRunAsGoal: detail.setResumeRunAsGoal,
    setShowTaskForm: formState.setShowTaskForm,
    setTaskDetail: detail.setTaskDetail,
    setTaskFileError: files.setTaskFileError,
    setTaskFileUploadProgress: files.setTaskFileUploadProgress,
    setTaskFileUploading: files.setTaskFileUploading,
    setTaskForm: formState.setTaskForm,
    setTaskFiles: files.setTaskFiles,
    taskDetail: detail.taskDetail,
    taskForm: formState.taskForm,
    taskFiles: files.taskFiles,
    taskFileInputRef: files.taskFileInputRef
  });

  const listActions = useMemo(
    () => ({
      handleDeleteTask: actions.handleDeleteTask,
      handleStopTask: actions.handleStopTask
    }),
    [actions.handleDeleteTask, actions.handleStopTask]
  );

  const visibleTasks = useMemo(() => {
    const filtered = selection.taskFilterEnvId
      ? tasks.filter((task) => task.envId === selection.taskFilterEnvId)
      : tasks;
    return filtered
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [selection.taskFilterEnvId, tasks]);

  useEffect(() => {
    const queryTaskId = readTaskIdQuery();
    if (!queryTaskId || selection.selectedTaskId || tasks.length === 0) {
      return;
    }
    if (!tasks.some((task) => task.taskId === queryTaskId)) {
      return;
    }
    selection.setSelectedTaskId(queryTaskId, { preserveCompose: true });
  }, [selection, tasks]);

  const hasActiveRuns = useMemo(() => {
    const taskRunning = tasks.some((task) => isActiveTaskStatus(task.status));
    const detailRunning = isActiveTaskStatus(detail.taskDetail?.status);
    const detailRuns = detail.taskDetail?.runs || detail.taskDetail?.runLogs || [];
    const runRunning = detailRuns.some((run) => isActiveTaskStatus(run.status));
    return taskRunning || detailRunning || runRunning;
  }, [detail.taskDetail, tasks]);

  const now = useNow(hasActiveRuns);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const running = tasks.filter((task) => isActiveTaskStatus(task.status)).length;
    const failed = tasks.filter((task) => task.status === 'failed').length;
    return { failed, running, total };
  }, [tasks]);

  const gitStatusDisplay = useMemo(
    () => getGitStatusDisplay(detail.taskDetail?.gitStatus),
    [detail.taskDetail?.gitStatus]
  );

  return {
    actions,
    detail,
    files,
    formState,
    gitStatusDisplay,
    handleResumeModelChoiceChange,
    hasActiveRuns,
    listActions,
    now,
    selection,
    taskStats,
    visibleTasks
  };
}

export default useTasksState;
