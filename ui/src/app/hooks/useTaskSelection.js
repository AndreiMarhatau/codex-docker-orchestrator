import { useCallback, useState } from 'react';
import { readTaskIdQuery, writeTaskIdQuery } from '../query-state.js';

function useTaskSelection() {
  const [selectedTaskIdState, setSelectedTaskIdState] = useState(readTaskIdQuery);
  const [taskFilterEnvId, setTaskFilterEnvId] = useState('');
  const selectedTaskId = selectedTaskIdState || readTaskIdQuery();

  const setSelectedTaskId = useCallback((taskId, options = {}) => {
    const { preserveCompose = false } = options;
    const currentTaskId = selectedTaskIdState || readTaskIdQuery();
    setSelectedTaskIdState(taskId);
    writeTaskIdQuery(taskId, {
      clearCompose: !preserveCompose && (!taskId || currentTaskId !== taskId),
      clearDetailTab: !taskId || currentTaskId !== taskId
    });
  }, [selectedTaskIdState]);

  function handleBackToTasks() {
    setSelectedTaskId('');
  }

  return {
    handleBackToTasks,
    selectedTaskId,
    setSelectedTaskId,
    setTaskFilterEnvId,
    taskFilterEnvId
  };
}

export default useTaskSelection;
