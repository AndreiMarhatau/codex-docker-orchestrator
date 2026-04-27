import { apiRequest } from '../../api.js';

function createHandleCommitPushTask({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return async function handleCommitPushTask(message = '') {
    if (!selectedTaskId) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${selectedTaskId}/commit-push`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      await refreshTaskDetail(selectedTaskId);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };
}

function createHandleReviewTask({ refreshTaskDetail, selectedTaskId, setError, setLoading }) {
  return async function handleReviewTask(reviewInput) {
    if (!selectedTaskId) {
      return false;
    }
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${selectedTaskId}/review`, {
        method: 'POST',
        body: JSON.stringify(reviewInput)
      });
      await refreshTaskDetail(selectedTaskId);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
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
  createHandleCommitPushTask,
  createHandleDeleteTask,
  createHandleReviewTask,
  createHandleStopTask
};
