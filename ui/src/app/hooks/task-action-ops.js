import { apiRequest } from '../../api.js';

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

export { createHandleDeleteTask, createHandlePushTask, createHandleStopTask };
