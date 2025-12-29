import { apiRequest, apiUrl } from '../../api.js';
import { emptyResumeConfig, emptyTaskForm } from '../constants.js';
import { resolveModelValue, resolveReasoningEffortValue } from '../model-helpers.js';

async function uploadTaskImages(taskImages, setTaskImageUploading) {
  if (taskImages.length === 0) {
    return [];
  }
  setTaskImageUploading(true);
  try {
    const formData = new FormData();
    taskImages.forEach((file) => {
      formData.append('images', file);
    });
    const response = await fetch(apiUrl('/api/uploads'), {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Image upload failed.');
    }
    const uploadPayload = await response.json();
    return (uploadPayload.uploads || []).map((upload) => upload.path);
  } finally {
    setTaskImageUploading(false);
  }
}

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
  setTaskForm,
  setTaskImageError,
  setTaskImageUploading,
  taskForm,
  taskImages,
  taskImageInputRef
}) {
  return async function handleCreateTask() {
    setError('');
    setTaskImageError('');
    setLoading(true);
    try {
      const imagePaths = await uploadTaskImages(taskImages, setTaskImageUploading);
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
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: taskForm.useHostDockerSocket,
          contextRepos: contextRepos.length > 0 ? contextRepos : undefined
        })
      });
      setTaskForm(emptyTaskForm);
      handleClearTaskImages();
      if (taskImageInputRef.current) {
        taskImageInputRef.current.value = '';
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
  resumeConfig,
  resumePrompt,
  resumeUseHostDockerSocket,
  selectedTaskId,
  setError,
  setLoading,
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

function createHandlePushTask({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return async function handlePushTask() {
    if (!selectedTaskId) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${selectedTaskId}/push`, { method: 'POST' });
      await refreshTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
}

function createHandleStopTask({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return async function handleStopTask(taskId = selectedTaskId) {
    if (!taskId) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/stop`, { method: 'POST' });
      if (taskId === selectedTaskId) {
        await refreshTaskDetail(taskId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
}

function createHandleDeleteTask({
  refreshAll,
  selectedTaskId,
  setError,
  setLoading,
  setSelectedTaskId,
  setTaskDetail
}) {
  return async function handleDeleteTask(taskId) {
    if (!taskId) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (taskId === selectedTaskId) {
        setSelectedTaskId('');
        setTaskDetail(null);
      }
      await refreshAll();
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
