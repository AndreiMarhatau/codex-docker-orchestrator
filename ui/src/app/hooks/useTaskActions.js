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
  resumeConfig,
  resumePrompt,
  resumeUseHostDockerSocket,
  selectedTaskId,
  setSelectedTaskId,
  setError,
  setLoading,
  setResumeConfig,
  setResumeDockerTouched,
  setResumePrompt,
  setShowTaskForm,
  setTaskForm,
  setTaskDetail,
  setTaskImageError,
  setTaskImageUploading,
  taskForm,
  taskImages,
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
      setTaskImageError,
      setTaskImageUploading,
      taskForm,
      taskImages,
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
      resumeConfig,
      resumePrompt,
      resumeUseHostDockerSocket,
      selectedTaskId,
      setError,
      setLoading,
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
