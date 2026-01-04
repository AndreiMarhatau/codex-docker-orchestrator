import { apiRequest } from '../../api.js';
import { emptyResumeConfig, emptyTaskForm } from '../constants.js';
import { resolveModelValue, resolveReasoningEffortValue } from '../model-helpers.js';
import {
  createHandleDeleteTask,
  createHandlePushTask,
  createHandleStopTask
} from './task-action-ops.js';
import {
  addTaskAttachments,
  removeTaskAttachments,
  uploadTaskFiles,
  uploadTaskImages
} from './task-upload-helpers.js';

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
  handleClearTaskImages,
  refreshAll,
  setError,
  setLoading,
  setShowTaskForm,
  setTaskFileError,
  setTaskFileUploading,
  setTaskFiles,
  setTaskForm,
  setTaskImageError,
  setTaskImageUploading,
  taskForm,
  taskFiles,
  taskImages,
  taskFileInputRef,
  taskImageInputRef
}) {
  return async function handleCreateTask() {
    setError('');
    setTaskImageError('');
    setTaskFileError('');
    setLoading(true);
    try {
      const imagePaths = await uploadTaskImages(taskImages, setTaskImageUploading);
      const fileUploads = await uploadTaskFiles(taskFiles, setTaskFileUploading);
      const modelValue = resolveModelValue(taskForm.modelChoice, taskForm.customModel);
      const reasoningEffortValue = resolveReasoningEffortValue(taskForm);
      const contextRepos = buildContextRepos(taskForm.contextRepos);
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          envId: taskForm.envId,
          ref: taskForm.ref,
          prompt: taskForm.prompt,
          imagePaths,
          fileUploads,
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: taskForm.useHostDockerSocket,
          contextRepos: contextRepos.length > 0 ? contextRepos : undefined
        })
      });
      setTaskForm(emptyTaskForm);
      handleClearTaskImages();
      setTaskFiles([]);
      if (taskImageInputRef.current) {
        taskImageInputRef.current.value = '';
      }
      if (taskFileInputRef.current) {
        taskFileInputRef.current.value = '';
      }
      setShowTaskForm(false);
      await refreshAll();
    } catch (err) {
      setError(err.message);
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
}) {
  return async function handleResumeTask() {
    if (!selectedTaskId || !resumePrompt.trim()) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (resumeAttachmentRemovals.length > 0) {
        await removeTaskAttachments(selectedTaskId, resumeAttachmentRemovals);
      }
      if (resumeFiles.taskFiles.length > 0) {
        await addTaskAttachments(
          selectedTaskId,
          resumeFiles.taskFiles,
          resumeFiles.setTaskFileUploading
        );
      }
      const modelValue = resolveModelValue(resumeConfig.modelChoice, resumeConfig.customModel);
      const reasoningEffortValue = resolveReasoningEffortValue(resumeConfig);
      await apiRequest(`/api/tasks/${selectedTaskId}/resume`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: resumePrompt,
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: resumeUseHostDockerSocket
        })
      });
      resumeFiles.handleClearTaskFiles();
      setResumeAttachmentRemovals([]);
      setResumePrompt('');
      setResumeConfig(emptyResumeConfig);
      setResumeDockerTouched(false);
      await refreshAll();
      await refreshTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err.message);
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
