import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api.js';
import { emptyEnvForm } from '../constants.js';

function parseEnvVarsText(envVarsText) {
  if (!envVarsText || !envVarsText.trim()) {
    return {};
  }
  const envVars = {};
  const envKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const lines = envVarsText.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Line ${index + 1} must be KEY=VALUE.`);
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (!key) {
      throw new Error(`Line ${index + 1} is missing a key.`);
    }
    if (!envKeyPattern.test(key)) {
      throw new Error(`Line ${index + 1} has an invalid key '${key}'.`);
    }
    envVars[key] = value;
  });
  return envVars;
}

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
    let envVars = {};
    try {
      envVars = parseEnvVarsText(envForm.envVarsText);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    try {
      await apiRequest('/api/envs', {
        method: 'POST',
        body: JSON.stringify({
          repoUrl: envForm.repoUrl,
          defaultBranch: envForm.defaultBranch,
          envVars
        })
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
