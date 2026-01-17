import { useEffect, useMemo, useState } from 'react';
import { emptyEnvForm } from '../constants.js';
import {
  envVarsToText,
  requestCreateEnv,
  requestDeleteEnv,
  requestUpdateEnv
} from './environment-helpers.js';

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
  const emptyEnvEditForm = useMemo(() => ({ defaultBranch: '', envVarsText: '' }), []);
  const [envEditForm, setEnvEditForm] = useState(emptyEnvEditForm);

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === selectedEnvId),
    [envs, selectedEnvId]
  );
  const envEditDefaults = useMemo(() => {
    if (!selectedEnv) {
      return emptyEnvEditForm;
    }
    return {
      defaultBranch: selectedEnv.defaultBranch || '',
      envVarsText: envVarsToText(selectedEnv.envVars)
    };
  }, [emptyEnvEditForm, selectedEnv]);
  const isEnvEditDirty = useMemo(() => {
    if (!selectedEnv) {
      return false;
    }
    return (
      envEditForm.defaultBranch.trim() !== envEditDefaults.defaultBranch ||
      envEditForm.envVarsText !== envEditDefaults.envVarsText
    );
  }, [envEditDefaults, envEditForm, selectedEnv]);

  useEffect(() => {
    if (!selectedEnvId && envs.length > 0) {
      setSelectedEnvId(envs[0].envId);
    }
  }, [envs, selectedEnvId]);

  useEffect(() => {
    setEnvEditForm(envEditDefaults);
  }, [envEditDefaults]);

  function resetEnvEditForm() {
    setEnvEditForm(envEditDefaults);
  }

  const handleCreateEnv = () =>
    requestCreateEnv({
      envForm,
      refreshAll,
      setEnvForm,
      setError,
      setLoading
    });
  const handleUpdateEnv = () =>
    requestUpdateEnv({
      envEditForm,
      refreshAll,
      selectedEnv,
      setError,
      setLoading
    });
  const handleDeleteEnv = (envId) =>
    requestDeleteEnv({
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
    });

  return {
    envForm,
    envEditForm,
    handleCreateEnv,
    handleDeleteEnv,
    handleUpdateEnv,
    isEnvEditDirty,
    resetEnvEditForm,
    selectedEnv,
    selectedEnvId,
    setEnvEditForm,
    setEnvForm,
    setSelectedEnvId
  };
}

export default useEnvironmentState;
