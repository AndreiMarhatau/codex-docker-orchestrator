import { useCallback, useState } from 'react';
import { readTaskIdQuery, writeTaskIdQuery } from '../query-state.js';

function useTaskSelection() {
  const [selectedTaskIdState, setSelectedTaskIdState] = useState(readTaskIdQuery);
  const [taskFilterEnvId, setTaskFilterEnvId] = useState('');
  const selectedTaskId = selectedTaskIdState || readTaskIdQuery();

  const setSelectedTaskId = useCallback((taskId) => {
    setSelectedTaskIdState(taskId);
    writeTaskIdQuery(taskId);
  }, []);

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
