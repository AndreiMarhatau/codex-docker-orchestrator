import { useEffect } from 'react';

function usePolling({ enabled = true, refreshAll, refreshTaskDetail, selectedTaskId }) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const interval = setInterval(() => {
      refreshAll().catch(() => {});
      if (selectedTaskId) {
        refreshTaskDetail(selectedTaskId).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [enabled, refreshAll, refreshTaskDetail, selectedTaskId]);
}

export default usePolling;
