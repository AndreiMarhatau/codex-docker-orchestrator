import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyEnvForm } from '../constants.js';
import {
  envVarsToText,
  requestCreateEnv,
  requestDeleteEnv,
  requestUpdateEnv
} from './environment-helpers.js';

function useEnvEditSync({
  envEditDefaults,
  envEditForm,
  hasEnvEditChanges,
  isEditOpen,
  selectedEnvId,
  setEnvEditForm,
  setHasEnvEditChanges
}) {
  const previousEnvIdRef = useRef('');

  useEffect(() => {
    if (!hasEnvEditChanges) {
      return;
    }
    const matchesDefaults =
      envEditForm.defaultBranch.trim() === envEditDefaults.defaultBranch &&
      envEditForm.envVarsText === envEditDefaults.envVarsText;
    if (matchesDefaults) {
      setHasEnvEditChanges(false);
    }
  }, [envEditDefaults, envEditForm, hasEnvEditChanges, setHasEnvEditChanges]);

  useEffect(() => {
    const prevEnvId = previousEnvIdRef.current;
    const envChanged = Boolean(prevEnvId) && prevEnvId !== selectedEnvId;
    if (envChanged || !isEditOpen || !hasEnvEditChanges) {
      setEnvEditForm(envEditDefaults);
      setHasEnvEditChanges(false);
    }
    previousEnvIdRef.current = selectedEnvId;
  }, [
    envEditDefaults,
    hasEnvEditChanges,
    isEditOpen,
    selectedEnvId,
    setEnvEditForm,
    setHasEnvEditChanges
  ]);
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
  const emptyEnvEditForm = useMemo(() => ({ defaultBranch: '', envVarsText: '' }), []);
  const [envEditForm, setEnvEditForm] = useState(emptyEnvEditForm);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [hasEnvEditChanges, setHasEnvEditChanges] = useState(false);

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
    return hasEnvEditChanges && (
      envEditForm.defaultBranch.trim() !== envEditDefaults.defaultBranch ||
      envEditForm.envVarsText !== envEditDefaults.envVarsText
    );
  }, [envEditDefaults, envEditForm, hasEnvEditChanges, selectedEnv]);

  useEffect(() => {
    if (!selectedEnvId && envs.length > 0) {
      setSelectedEnvId(envs[0].envId);
    }
  }, [envs, selectedEnvId]);

  useEnvEditSync({
    envEditDefaults,
    envEditForm,
    hasEnvEditChanges,
    isEditOpen,
    selectedEnvId,
    setEnvEditForm,
    setHasEnvEditChanges
  });

  function resetEnvEditForm() {
    setEnvEditForm(envEditDefaults);
    setHasEnvEditChanges(false);
  }

  const handleSetEnvEditForm = (updater) => {
    setHasEnvEditChanges(true);
    if (typeof updater === 'function') {
      setEnvEditForm((prev) => updater(prev));
    } else {
      setEnvEditForm(updater);
    }
  };

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
    setIsEditOpen(true);
  };
  const handleCloseEditEnv = () => {
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
    setEnvEditForm: handleSetEnvEditForm,
    setEnvForm,
    setSelectedEnvId
  };
}

export default useEnvironmentState;
