import {
  useCreateTaskHandler,
  useDeleteTaskHandler,
  usePushTaskHandler,
  useResumeTaskHandler,
  useStopTaskHandler
} from './task-action-hooks.js';

function useTaskActions({
  handleClearTaskImages,
  refreshAll,
  refreshTaskDetail,
  resumeAttachmentRemovals,
  resumeConfig,
  resumeContextRepos,
  resumeContextTouched,
  resumeFiles,
  resumePrompt,
  resumeRepoReadOnly,
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
  setResumeRepoReadOnly,
  setResumeRepoReadOnlyTouched,
  setShowTaskForm,
  setTaskForm,
  setTaskDetail,
  setTaskFileError,
  setTaskFileUploading,
  setTaskFiles,
  setTaskImageError,
  setTaskImageUploading,
  taskForm,
  taskFiles,
  taskImages,
  taskFileInputRef,
  taskImageInputRef
}) {
  const handleCreateTask = useCreateTaskHandler({
    handleClearTaskImages,
    refreshAll,
    setError,
    setLoading,
    setShowTaskForm,
    setTaskForm,
    setTaskFileError,
    setTaskFileUploading,
    setTaskImageError,
    setTaskImageUploading,
    setTaskFiles,
    taskForm,
    taskFiles,
    taskImages,
    taskFileInputRef,
    taskImageInputRef
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
    resumeRepoReadOnly,
    resumeUseHostDockerSocket,
    selectedTaskId,
    setError,
    setLoading,
    setResumeAttachmentRemovals,
    setResumeConfig,
    setResumeContextRepos,
    setResumeContextTouched,
    setResumeDockerTouched,
    setResumePrompt,
    setResumeRepoReadOnly,
    setResumeRepoReadOnlyTouched
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
