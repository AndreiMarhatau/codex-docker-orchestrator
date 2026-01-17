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

function envVarsToText(envVars) {
  if (!envVars || typeof envVars !== 'object') {
    return '';
  }
  return Object.keys(envVars)
    .filter(Boolean)
    .sort()
    .map((key) => `${key}=${envVars[key]}`)
    .join('\n');
}

async function requestCreateEnv({ envForm, refreshAll, setEnvForm, setError, setLoading }) {
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

async function requestUpdateEnv({ envEditForm, refreshAll, selectedEnv, setError, setLoading }) {
  if (!selectedEnv) {
    return;
  }
  const trimmedBranch = envEditForm.defaultBranch.trim();
  if (!trimmedBranch) {
    setError('Base branch is required.');
    return;
  }
  setError('');
  setLoading(true);
  let envVars = {};
  try {
    envVars = parseEnvVarsText(envEditForm.envVarsText);
  } catch (err) {
    setError(err.message);
    setLoading(false);
    return;
  }
  try {
    await apiRequest(`/api/envs/${selectedEnv.envId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        defaultBranch: trimmedBranch,
        envVars
      })
    });
    await refreshAll();
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

async function requestDeleteEnv({
  envId,
  refreshAll,
  selectedEnvId,
  selectedTaskId,
  setError,
  setLoading,
  setSelectedEnvId,
  setSelectedTaskId,
  setTaskDetail,
  tasks
}) {
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

export { envVarsToText, requestCreateEnv, requestDeleteEnv, requestUpdateEnv };
