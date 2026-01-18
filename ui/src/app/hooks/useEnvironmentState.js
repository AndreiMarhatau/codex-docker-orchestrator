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
  const [isEditOpen, setIsEditOpen] = useState(false);

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
      onSuccess: () => setIsEditOpen(false),
      refreshAll,
      selectedEnv,
      setError,
      setLoading
    });
  const handleOpenEditEnv = (envId) => {
    if (envId) {
      setSelectedEnvId(envId);
    }
    resetEnvEditForm();
    setIsEditOpen(true);
  };
  const handleCloseEditEnv = () => {
    resetEnvEditForm();
    setIsEditOpen(false);
  };
  const handleDeleteEnv = (envId) =>
    requestDeleteEnv({
      envId,
      ...(envId === selectedEnvId ? { onCloseEdit: () => setIsEditOpen(false) } : {}),
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
    handleCloseEditEnv,
    handleDeleteEnv,
    handleOpenEditEnv,
    handleUpdateEnv,
    isEditOpen,
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
