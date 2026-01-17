import { Box, Card, CardContent, Divider, Stack } from '@mui/material';
import EnvironmentEditor from './environments/EnvironmentEditor.jsx';
import EnvironmentForm from './environments/EnvironmentForm.jsx';
import EnvironmentHeader from './environments/EnvironmentHeader.jsx';
import EnvironmentList from './environments/EnvironmentList.jsx';

function EnvironmentsTab({ data, envState }) {
  const { envs, loading, refreshAll } = data;
  const {
    envForm,
    handleCreateEnv,
    handleDeleteEnv,
    handleUpdateEnv,
    envEditForm,
    isEnvEditDirty,
    resetEnvEditForm,
    selectedEnv,
    selectedEnvId,
    setEnvForm,
    setEnvEditForm,
    setSelectedEnvId
  } = envState;

  return (
    <Box className="section-shell fade-in">
      <Card className="panel-card">
        <CardContent className="panel-content">
          <Stack spacing={3}>
            <EnvironmentHeader
              envs={envs}
              loading={loading}
              refreshAll={refreshAll}
              selectedEnv={selectedEnv}
            />
            <Divider />
            <EnvironmentForm
              envForm={envForm}
              handleCreateEnv={handleCreateEnv}
              loading={loading}
              setEnvForm={setEnvForm}
            />
            <Divider />
            <EnvironmentList
              envs={envs}
              handleDeleteEnv={handleDeleteEnv}
              selectedEnvId={selectedEnvId}
              setSelectedEnvId={setSelectedEnvId}
            />
            <Divider />
            <EnvironmentEditor
              envEditForm={envEditForm}
              handleUpdateEnv={handleUpdateEnv}
              isDirty={isEnvEditDirty}
              loading={loading}
              resetEnvEditForm={resetEnvEditForm}
              selectedEnv={selectedEnv}
              setEnvEditForm={setEnvEditForm}
            />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default EnvironmentsTab;
