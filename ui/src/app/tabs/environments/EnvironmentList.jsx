import { Button, Card, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function EnvironmentList({ envs, handleDeleteEnv, selectedEnvId, setSelectedEnvId }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6" className="panel-title">
        Environments
      </Typography>
      <Stack spacing={1.5}>
        {envs.map((env) => (
          <Card
            key={env.envId}
            className="task-card"
            sx={{
              borderColor: env.envId === selectedEnvId ? 'primary.main' : 'divider',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedEnvId(env.envId)}
          >
            <CardContent>
              <Stack spacing={0.5}>
                <Tooltip title={env.repoUrl || ''}>
                  <Typography fontWeight={600}>
                    {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                  </Typography>
                </Tooltip>
                <Typography color="text.secondary" className="mono">
                  {env.envId}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={`default: ${env.defaultBranch}`} />
                  <Button
                    size="small"
                    color="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteEnv(env.envId);
                    }}
                  >
                    Remove
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {envs.length === 0 && (
          <Typography color="text.secondary">
            No environments yet. Create one to get started.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

export default EnvironmentList;
