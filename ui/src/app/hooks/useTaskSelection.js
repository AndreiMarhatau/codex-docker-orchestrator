import { useState } from 'react';

function useTaskSelection() {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskFilterEnvId, setTaskFilterEnvId] = useState('');

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
