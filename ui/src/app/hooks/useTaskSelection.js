import { useCallback, useState } from 'react';
import { readTaskIdQuery, writeTaskIdQuery } from '../query-state.js';

function useTaskSelection() {
  const [selectedTaskIdState, setSelectedTaskIdState] = useState(readTaskIdQuery);
  const [taskFilterEnvId, setTaskFilterEnvId] = useState('');
  const selectedTaskId = selectedTaskIdState || readTaskIdQuery();

  const setSelectedTaskId = useCallback((taskId) => {
    const currentTaskId = selectedTaskIdState || readTaskIdQuery();
    setSelectedTaskIdState(taskId);
    writeTaskIdQuery(taskId, {
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
