import {
  createHandleCreateTask,
  createHandleDeleteTask,
  createHandlePushTask,
  createHandleResumeTask,
  createHandleStopTask
} from './task-action-builders.js';

function useTaskActions({
  handleClearTaskImages,
  refreshAll,
  refreshTaskDetail,
  resumeAttachmentRemovals,
  resumeConfig,
  resumeFiles,
  resumePrompt,
  resumeUseHostDockerSocket,
  selectedTaskId,
  setSelectedTaskId,
  setError,
  setLoading,
  setResumeAttachmentRemovals,
  setResumeConfig,
  setResumeDockerTouched,
  setResumePrompt,
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
  return {
    handleCreateTask: createHandleCreateTask({
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
    }),
    handleDeleteTask: createHandleDeleteTask({
      refreshAll,
      selectedTaskId,
      setError,
      setLoading,
      setSelectedTaskId,
      setTaskDetail
    }),
    handlePushTask: createHandlePushTask({
      refreshTaskDetail,
      selectedTaskId,
      setError,
      setLoading
    }),
    handleResumeTask: createHandleResumeTask({
      refreshAll,
      refreshTaskDetail,
      resumeAttachmentRemovals,
      resumeConfig,
      resumeFiles,
      resumePrompt,
      resumeUseHostDockerSocket,
      selectedTaskId,
      setError,
      setLoading,
      setResumeAttachmentRemovals,
      setResumeConfig,
      setResumeDockerTouched,
      setResumePrompt
    }),
    handleStopTask: createHandleStopTask({
      refreshTaskDetail,
      selectedTaskId,
      setError,
      setLoading
    })
  };
}

export default useTaskActions;
