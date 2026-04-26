import {
  useCommitPushTaskHandler,
  useCreateTaskHandler,
  useDeleteTaskHandler,
  useReviewTaskHandler,
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
  setTaskFileUploadProgress,
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
    setTaskFileUploadProgress,
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

  const handleCommitPushTask = useCommitPushTaskHandler({
    refreshTaskDetail,
    selectedTaskId,
    setError,
    setLoading
  });

  const handleReviewTask = useReviewTaskHandler({
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
    handleCommitPushTask,
    handleDeleteTask,
    handleReviewTask,
    handleResumeTask,
    handleStopTask
  };
}

export default useTaskActions;
