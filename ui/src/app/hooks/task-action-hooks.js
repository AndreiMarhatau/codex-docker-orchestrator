import { useMemo } from 'react';
import {
  createHandleCreateTask,
  createHandleDeleteTask,
  createHandlePushTask,
  createHandleResumeTask,
  createHandleStopTask
} from './task-action-builders.js';

function useCreateTaskHandler({
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
}) {
  return useMemo(
    () =>
      createHandleCreateTask({
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
    [
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
    ]
  );
}

function useDeleteTaskHandler({
  refreshAll,
  selectedTaskId,
  setError,
  setLoading,
  setSelectedTaskId,
  setTaskDetail
}) {
  return useMemo(
    () =>
      createHandleDeleteTask({
        refreshAll,
        selectedTaskId,
        setError,
        setLoading,
        setSelectedTaskId,
        setTaskDetail
      }),
    [refreshAll, selectedTaskId, setError, setLoading, setSelectedTaskId, setTaskDetail]
  );
}

function usePushTaskHandler({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return useMemo(
    () =>
      createHandlePushTask({
        refreshTaskDetail,
        selectedTaskId,
        setError,
        setLoading
      }),
    [refreshTaskDetail, selectedTaskId, setError, setLoading]
  );
}

function useResumeTaskHandler({
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
}) {
  return useMemo(
    () =>
      createHandleResumeTask({
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
      }),
    [
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
    ]
  );
}

function useStopTaskHandler({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return useMemo(
    () =>
      createHandleStopTask({
        refreshTaskDetail,
        selectedTaskId,
        setError,
        setLoading
      }),
    [refreshTaskDetail, selectedTaskId, setError, setLoading]
  );
}

export {
  useCreateTaskHandler,
  useDeleteTaskHandler,
  usePushTaskHandler,
  useResumeTaskHandler,
  useStopTaskHandler
};
