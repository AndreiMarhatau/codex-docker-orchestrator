import { Box, Card, CardContent, Divider, Stack } from '@mui/material';
import EnvironmentForm from './environments/EnvironmentForm.jsx';
import EnvironmentHeader from './environments/EnvironmentHeader.jsx';
import EnvironmentList from './environments/EnvironmentList.jsx';

function EnvironmentsTab({ data, envState }) {
  const { envs, loading, refreshAll } = data;
  const {
    envForm,
    handleCreateEnv,
    handleDeleteEnv,
    selectedEnv,
    selectedEnvId,
    setEnvForm,
    setSelectedEnvId
  } = envState;

  return (
    <Box className="section-shell fade-in">
      <Card className="panel-card">
        <CardContent>
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
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default EnvironmentsTab;
