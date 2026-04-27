import { useCallback, useMemo, useState } from 'react';

function normalizeDeleteTarget(task) {
  if (!task) {
    return null;
  }
  if (typeof task === 'string') {
    return { taskId: task };
  }
  return task;
}

function useTaskDeleteConfirmation({ handleDeleteTask, loading = false }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const requestDeleteTask = useCallback((task) => {
    const target = normalizeDeleteTarget(task);
    if (!target?.taskId) {
      return;
    }
    setDeleteTarget(target);
  }, []);

  const closeDeleteConfirmation = useCallback(() => {
    if (!loading) {
      setDeleteTarget(null);
    }
  }, [loading]);

  const confirmDeleteTask = useCallback(async () => {
    const taskId = deleteTarget?.taskId;
    if (!taskId) {
      return;
    }
    setDeleteTarget(null);
    await handleDeleteTask?.(taskId);
  }, [deleteTarget, handleDeleteTask]);

  const deleteDialogProps = useMemo(
    () => ({
      loading,
      onClose: closeDeleteConfirmation,
      onConfirm: confirmDeleteTask,
      open: Boolean(deleteTarget),
      task: deleteTarget
    }),
    [closeDeleteConfirmation, confirmDeleteTask, deleteTarget, loading]
  );

  return {
    deleteDialogProps,
    requestDeleteTask
  };
}

export default useTaskDeleteConfirmation;
