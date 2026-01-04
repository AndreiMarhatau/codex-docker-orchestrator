import { useMemo } from 'react';
import { MODEL_CUSTOM_VALUE } from '../constants.js';
import { getGitStatusDisplay } from '../git-helpers.js';
import { getEffortOptionsForModel } from '../model-helpers.js';
import useNow from './useNow.js';
import useTaskActions from './useTaskActions.js';
import useTaskDetail from './useTaskDetail.js';
import useTaskFormState from './useTaskFormState.js';
import useTaskFiles from './useTaskFiles.js';
import useTaskImages from './useTaskImages.js';
import useTaskSelection from './useTaskSelection.js';

function useTasksState({ envs, refreshAll, setError, setLoading, tasks }) {
  const selection = useTaskSelection();
  const formState = useTaskFormState({
    envs,
    selectedTaskId: selection.selectedTaskId,
    tasks
  });
  const files = useTaskFiles();
  const images = useTaskImages();
  const detail = useTaskDetail({
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
    handleClearTaskImages: images.handleClearTaskImages,
    refreshAll,
    refreshTaskDetail: detail.refreshTaskDetail,
    resumeAttachmentRemovals: detail.resumeAttachmentRemovals,
    resumeConfig: detail.resumeConfig,
    resumeFiles: detail.resumeFiles,
    resumePrompt: detail.resumePrompt,
    resumeUseHostDockerSocket: detail.resumeUseHostDockerSocket,
    selectedTaskId: selection.selectedTaskId,
    setSelectedTaskId: selection.setSelectedTaskId,
    setError,
    setLoading,
    setResumeAttachmentRemovals: detail.setResumeAttachmentRemovals,
    setResumeConfig: detail.setResumeConfig,
    setResumeDockerTouched: detail.setResumeDockerTouched,
    setResumePrompt: detail.setResumePrompt,
    setShowTaskForm: formState.setShowTaskForm,
    setTaskDetail: detail.setTaskDetail,
    setTaskFileError: files.setTaskFileError,
    setTaskFileUploading: files.setTaskFileUploading,
    setTaskForm: formState.setTaskForm,
    setTaskImageError: images.setTaskImageError,
    setTaskImageUploading: images.setTaskImageUploading,
    setTaskFiles: files.setTaskFiles,
    taskForm: formState.taskForm,
    taskFiles: files.taskFiles,
    taskImages: images.taskImages,
    taskFileInputRef: files.taskFileInputRef,
    taskImageInputRef: images.taskImageInputRef
  });

  const visibleTasks = useMemo(() => {
    const filtered = selection.taskFilterEnvId
      ? tasks.filter((task) => task.envId === selection.taskFilterEnvId)
      : tasks;
    return filtered
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [selection.taskFilterEnvId, tasks]);

  const hasActiveRuns = useMemo(() => {
    const taskRunning = tasks.some(
      (task) => task.status === 'running' || task.status === 'stopping'
    );
    const detailRunning =
      detail.taskDetail?.status === 'running' || detail.taskDetail?.status === 'stopping';
    const runRunning = (detail.taskDetail?.runs || []).some(
      (run) => run.status === 'running' || run.status === 'stopping'
    );
    return taskRunning || detailRunning || runRunning;
  }, [detail.taskDetail, tasks]);

  const now = useNow(hasActiveRuns);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const running = tasks.filter(
      (task) => task.status === 'running' || task.status === 'stopping'
    ).length;
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
    images,
    now,
    selection,
    taskStats,
    visibleTasks
  };
}

export default useTasksState;
