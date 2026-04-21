import { useState } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, Stack } from '@mui/material';
import EnvironmentEditor from './environments/EnvironmentEditor.jsx';
import EnvironmentForm from './environments/EnvironmentForm.jsx';
import EnvironmentHeader from './environments/EnvironmentHeader.jsx';
import EnvironmentList from './environments/EnvironmentList.jsx';

function EnvironmentsTab({ data, envState }) {
  const [createOpen, setCreateOpen] = useState(false);
  const { envs, loading, refreshAll } = data;
  const {
    envForm,
    handleCreateEnv,
    handleCloseEditEnv,
    handleDeleteEnv,
    handleOpenEditEnv,
    handleUpdateEnv,
    envEditForm,
    isEditOpen,
    isEnvEditDirty,
    resetEnvEditForm,
    selectedEnv,
    setEnvForm,
    setEnvEditForm
  } = envState;

  async function handleCreateAndClose() {
    const created = await Promise.resolve(handleCreateEnv());
    if (created) {
      setCreateOpen(false);
    }
  }

  return (
    <Box className="section-shell dense-workstation-tab dense-workstation-tab--environments fade-in">
      <Stack spacing={1.5}>
        <Box className="dense-tab-header">
          <EnvironmentHeader
            envs={envs}
            loading={loading}
            refreshAll={refreshAll}
            openCreateDialog={() => setCreateOpen(true)}
          />
        </Box>
        <Box>
          <EnvironmentList
            envs={envs}
            handleDeleteEnv={handleDeleteEnv}
            handleEditEnv={handleOpenEditEnv}
          />
        </Box>
        <Dialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ className: 'dense-dialog' }}
        >
          <DialogTitle>Register source</DialogTitle>
          <DialogContent>
            <EnvironmentForm
              envForm={envForm}
              handleCreateEnv={handleCreateAndClose}
              loading={loading}
              setEnvForm={setEnvForm}
              inDialog
            />
          </DialogContent>
        </Dialog>
        <EnvironmentEditor
          envEditForm={envEditForm}
          handleUpdateEnv={handleUpdateEnv}
          isDirty={isEnvEditDirty}
          isOpen={isEditOpen}
          loading={loading}
          onClose={handleCloseEditEnv}
          resetEnvEditForm={resetEnvEditForm}
          selectedEnv={selectedEnv}
          setEnvEditForm={setEnvEditForm}
        />
      </Stack>
    </Box>
  );
}

export default EnvironmentsTab;
