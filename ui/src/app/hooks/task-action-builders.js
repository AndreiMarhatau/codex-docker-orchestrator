import { apiRequest } from '../../api.js';
import { emptyResumeConfig, emptyTaskForm } from '../constants.js';
import { resolveModelValue, resolveReasoningEffortValue } from '../model-helpers.js';
import {
  createHandleDeleteTask,
  createHandlePushTask,
  createHandleStopTask
} from './task-action-ops.js';
import { uploadTaskFiles } from './task-upload-helpers.js';

function buildContextRepos(contextRepos) {
  return (contextRepos || [])
    .map((entry) => ({
      envId: (entry.envId || '').trim(),
      ref: (entry.ref || '').trim()
    }))
    .filter((entry) => entry.envId)
    .map((entry) => (entry.ref ? entry : { envId: entry.envId }));
}

function createHandleCreateTask({
  refreshAll,
  setError,
  setLoading,
  setShowTaskForm,
  setTaskFileError,
  setTaskFileUploadProgress,
  setTaskFileUploading,
  setTaskFiles,
  setTaskForm,
  taskForm,
  taskFiles,
  taskFileInputRef
}) {
  return async function handleCreateTask() {
    setError('');
    setTaskFileError('');
    setLoading(true);
    try {
      const fileUploads = await uploadTaskFiles(
        taskFiles,
        setTaskFileUploading,
        setTaskFileUploadProgress
      );
      const modelValue = resolveModelValue(taskForm.modelChoice, taskForm.customModel);
      const reasoningEffortValue = resolveReasoningEffortValue(taskForm);
      const contextRepos = buildContextRepos(taskForm.contextRepos);
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          envId: taskForm.envId,
          ref: taskForm.ref,
          prompt: taskForm.prompt,
          fileUploads,
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: taskForm.useHostDockerSocket,
          contextRepos: contextRepos.length > 0 ? contextRepos : undefined
        })
      });
      setTaskForm(emptyTaskForm);
      setTaskFiles([]);
      if (taskFileInputRef.current) {
        taskFileInputRef.current.value = '';
      }
      setShowTaskForm(false);
      await refreshAll();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };
}

function createHandleResumeTask({
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
  return async function handleResumeTask() {
    if (!selectedTaskId || !resumePrompt.trim()) {
      return false;
    }
    setError('');
    setLoading(true);
    try {
      const fileUploads = await uploadTaskFiles(
        resumeFiles.taskFiles,
        resumeFiles.setTaskFileUploading,
        resumeFiles.setTaskFileUploadProgress
      );
      const modelValue = resolveModelValue(resumeConfig.modelChoice, resumeConfig.customModel);
      const reasoningEffortValue = resolveReasoningEffortValue(resumeConfig);
      const contextRepos = buildContextRepos(resumeContextRepos);
      await apiRequest(`/api/tasks/${selectedTaskId}/resume`, {
        method: 'POST',
        body: JSON.stringify({
          attachmentRemovals: resumeAttachmentRemovals.length > 0 ? resumeAttachmentRemovals : undefined,
          fileUploads: fileUploads.length > 0 ? fileUploads : undefined,
          prompt: resumePrompt,
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: resumeUseHostDockerSocket,
          contextRepos: resumeContextTouched ? contextRepos : undefined
        })
      });
      resumeFiles.handleClearTaskFiles();
      setResumeAttachmentRemovals([]);
      setResumePrompt('');
      setResumeConfig(emptyResumeConfig);
      setResumeContextRepos([]);
      setResumeContextTouched(false);
      setResumeDockerTouched(false);
      await refreshAll();
      await refreshTaskDetail(selectedTaskId);
      return true;
    } catch (err) {
      setError(err.message);
      try {
        await refreshTaskDetail(selectedTaskId);
      } catch (_error) {
        // Keep the original submit error visible even if the refresh also fails.
      }
      return false;
    } finally {
      setLoading(false);
    }
  };
}

export {
  createHandleCreateTask,
  createHandleDeleteTask,
  createHandlePushTask,
  createHandleResumeTask,
  createHandleStopTask
};
