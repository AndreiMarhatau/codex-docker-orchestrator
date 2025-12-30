import { useEffect } from 'react';

function usePolling({ refreshAll, refreshTaskDetail, selectedTaskId }) {
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll().catch(() => {});
      if (selectedTaskId) {
        refreshTaskDetail(selectedTaskId).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshAll, refreshTaskDetail, selectedTaskId]);
}

export default usePolling;
