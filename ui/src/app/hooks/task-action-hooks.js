import { useMemo } from 'react';
import {
  createHandleCommitPushTask,
  createHandleCreateTask,
  createHandleDeleteTask,
  createHandleReviewTask,
  createHandleResumeTask,
  createHandleStopTask
} from './task-action-builders.js';

function useCreateTaskHandler({
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
}) {
  return useMemo(
    () =>
      createHandleCreateTask({
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
      }),
    [
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

function useCommitPushTaskHandler({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return useMemo(
    () =>
      createHandleCommitPushTask({
        refreshTaskDetail,
        selectedTaskId,
        setError,
        setLoading
      }),
    [refreshTaskDetail, selectedTaskId, setError, setLoading]
  );
}

function useReviewTaskHandler({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return useMemo(
    () =>
      createHandleReviewTask({
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
  resumeRunAsGoal,
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
  setResumeRunAsGoal,
  taskDetail
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
        resumeRunAsGoal,
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
        setResumeRunAsGoal,
        taskDetail
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
      resumeRunAsGoal,
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
      setResumeRunAsGoal,
      taskDetail
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

export { useCommitPushTaskHandler, useCreateTaskHandler, useDeleteTaskHandler };
export { useReviewTaskHandler, useResumeTaskHandler, useStopTaskHandler };
