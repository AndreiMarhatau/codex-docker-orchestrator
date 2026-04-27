import { useCallback, useMemo, useState } from 'react';

function normalizeStopTarget(task) {
  if (!task) {
    return null;
  }
  if (typeof task === 'string') {
    return { taskId: task };
  }
  return task;
}

function useTaskStopConfirmation({ handleStopTask, loading = false }) {
  const [stopTarget, setStopTarget] = useState(null);

  const requestStopTask = useCallback((task) => {
    const target = normalizeStopTarget(task);
    if (!target?.taskId) {
      return;
    }
    setStopTarget(target);
  }, []);

  const closeStopConfirmation = useCallback(() => {
    if (!loading) {
      setStopTarget(null);
    }
  }, [loading]);

  const confirmStopTask = useCallback(async () => {
    const taskId = stopTarget?.taskId;
    if (!taskId) {
      return;
    }
    setStopTarget(null);
    await handleStopTask?.(taskId);
  }, [handleStopTask, stopTarget]);

  const stopDialogProps = useMemo(
    () => ({
      loading,
      onClose: closeStopConfirmation,
      onConfirm: confirmStopTask,
      open: Boolean(stopTarget),
      task: stopTarget
    }),
    [closeStopConfirmation, confirmStopTask, loading, stopTarget]
  );

  return {
    requestStopTask,
    stopDialogProps
  };
}

export default useTaskStopConfirmation;
