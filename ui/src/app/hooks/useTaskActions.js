import {
  useCreateTaskHandler,
  useDeleteTaskHandler,
  usePushTaskHandler,
  useResumeTaskHandler,
  useStopTaskHandler
} from './task-action-hooks.js';

function useTaskActions({
  refreshAll,
  refreshTaskDetail,
  resumeAttachmentRemovals,
  resumeConfig,
  resumeContextRepos,
  resumeContextTouched,
  resumeFiles,
  resumePrompt,
  resumeUseHostDockerSocket,
  selectedTaskId,
  setSelectedTaskId,
  setError,
  setLoading,
  setResumeAttachmentRemovals,
  setResumeConfig,
  setResumeContextRepos,
  setResumeContextTouched,
  setResumeDockerTouched,
  setResumePrompt,
  setShowTaskForm,
  setTaskForm,
  setTaskDetail,
  setTaskFileError,
  setTaskFileUploading,
  setTaskFiles,
  taskForm,
  taskFiles,
  taskFileInputRef
}) {
  const handleCreateTask = useCreateTaskHandler({
    refreshAll,
    setError,
    setLoading,
    setShowTaskForm,
    setTaskForm,
    setTaskFileError,
    setTaskFileUploading,
    setTaskFiles,
    taskForm,
    taskFiles,
    taskFileInputRef
  });

  const handleDeleteTask = useDeleteTaskHandler({
    refreshAll,
    selectedTaskId,
    setError,
    setLoading,
    setSelectedTaskId,
    setTaskDetail
  });

  const handlePushTask = usePushTaskHandler({
    refreshTaskDetail,
    selectedTaskId,
    setError,
    setLoading
  });

  const handleResumeTask = useResumeTaskHandler({
    refreshAll,
    refreshTaskDetail,
    resumeAttachmentRemovals,
    resumeConfig,
    resumeContextRepos,
    resumeContextTouched,
    resumeFiles,
    resumePrompt,
    resumeUseHostDockerSocket,
    selectedTaskId,
    setError,
    setLoading,
    setResumeAttachmentRemovals,
    setResumeConfig,
    setResumeContextRepos,
    setResumeContextTouched,
    setResumeDockerTouched,
    setResumePrompt
  });

  const handleStopTask = useStopTaskHandler({
    refreshTaskDetail,
    selectedTaskId,
    setError,
    setLoading
  });

  return {
    handleCreateTask,
    handleDeleteTask,
    handlePushTask,
    handleResumeTask,
    handleStopTask
  };
}

export default useTaskActions;
