import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api.js';
import { emptyEnvForm } from '../constants.js';

function useEnvironmentState({
  envs,
  refreshAll,
  selectedTaskId,
  setError,
  setLoading,
  setSelectedTaskId,
  setTaskDetail,
  tasks
}) {
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [envForm, setEnvForm] = useState(emptyEnvForm);

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === selectedEnvId),
    [envs, selectedEnvId]
  );

  useEffect(() => {
    if (!selectedEnvId && envs.length > 0) {
      setSelectedEnvId(envs[0].envId);
    }
  }, [envs, selectedEnvId]);

  async function handleCreateEnv() {
    if (!envForm.repoUrl.trim()) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiRequest('/api/envs', {
        method: 'POST',
        body: JSON.stringify(envForm)
      });
      setEnvForm(emptyEnvForm);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEnv(envId) {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/envs/${envId}`, { method: 'DELETE' });
      await refreshAll();
      if (envId === selectedEnvId) {
        setSelectedEnvId('');
      }
      const selectedTask = tasks.find((task) => task.taskId === selectedTaskId);
      if (selectedTask && selectedTask.envId === envId) {
        setSelectedTaskId('');
        setTaskDetail(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    envForm,
    handleCreateEnv,
    handleDeleteEnv,
    selectedEnv,
    selectedEnvId,
    setEnvForm,
    setSelectedEnvId
  };
}

export default useEnvironmentState;
