import { useEffect, useRef } from 'react';
import { apiUrlWithPassword } from '../../api.js';
import { normalizeAccountState } from '../repo-helpers.js';

function useStateStream({
  enabled = true,
  reconnectRefreshMs = 60000,
  refreshAll,
  refreshTaskDetail,
  selectedTaskId,
  setAccountState,
  setEnvs,
  setError,
  setTasks
}) {
  const selectedTaskIdRef = useRef(selectedTaskId);
  const lastErrorRefreshAtRef = useRef(0);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const handleRefresh = () => {
      refreshAll().catch(() => {});
      const taskId = selectedTaskIdRef.current;
      if (taskId) {
        refreshTaskDetail(taskId).catch(() => {});
      }
    };
    if (typeof EventSource !== 'function') {
      handleRefresh();
      const fallbackInterval = setInterval(() => {
        handleRefresh();
      }, reconnectRefreshMs);
      return () => clearInterval(fallbackInterval);
    }

    const eventSource = new EventSource(apiUrlWithPassword('/api/events/stream'));

    const handleInit = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        setEnvs(Array.isArray(payload.envs) ? payload.envs : []);
        setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
        setAccountState(normalizeAccountState(payload.accounts));
        const taskId = selectedTaskIdRef.current;
        if (taskId) {
          await refreshTaskDetail(taskId);
        }
      } catch (error) {
        setError(error?.message || 'Failed to parse app state stream payload.');
      }
    };

    const handleError = () => {
      const now = Date.now();
      if (now - lastErrorRefreshAtRef.current < reconnectRefreshMs) {
        return;
      }
      lastErrorRefreshAtRef.current = now;
      handleRefresh();
    };

    eventSource.addEventListener('init', handleInit);
    eventSource.addEventListener('tasks_changed', handleRefresh);
    eventSource.addEventListener('envs_changed', handleRefresh);
    eventSource.addEventListener('accounts_changed', handleRefresh);
    eventSource.addEventListener('error', handleError);

    return () => {
      eventSource.removeEventListener('init', handleInit);
      eventSource.removeEventListener('tasks_changed', handleRefresh);
      eventSource.removeEventListener('envs_changed', handleRefresh);
      eventSource.removeEventListener('accounts_changed', handleRefresh);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    };
  }, [
    enabled,
    reconnectRefreshMs,
    refreshAll,
    refreshTaskDetail,
    setAccountState,
    setEnvs,
    setError,
    setTasks
  ]);
}

export default useStateStream;
