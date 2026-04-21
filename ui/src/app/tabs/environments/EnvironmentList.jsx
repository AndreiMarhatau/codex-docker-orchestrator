import { Box, Button, Chip, Divider, Stack, Tooltip, Typography } from '@mui/material';
import { formatRepoDisplay } from '../../repo-helpers.js';

function EnvironmentList({ envs, handleDeleteEnv, handleEditEnv }) {
  return (
    <Box className="dense-panel dense-panel--list">
      <Stack spacing={1.5}>
        <Stack spacing={0.35}>
          <Typography variant="h6" className="dense-panel-title">Registered sources</Typography>
          <Typography variant="body2" color="text.secondary" className="dense-panel-copy">
            Edit or remove a source directly from the row actions.
          </Typography>
        </Stack>
        <Stack
          className="dense-divider-list"
          spacing={0}
          divider={envs.length > 1 ? <Divider flexItem /> : undefined}
        >
          {envs.map((env) => (
            <Box
              key={env.envId}
              className="dense-list-row"
              sx={{
                py: 1.1,
                px: 0,
                borderRadius: 0
              }}
            >
              <Stack spacing={0.85}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.25}>
                    <Tooltip title={env.repoUrl || ''}>
                      <Typography fontWeight={600}>
                        {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                      </Typography>
                    </Tooltip>
                    <Typography color="text.secondary" variant="body2" className="mono">
                      {env.envId}
                    </Typography>
                  </Stack>
                  <Chip size="small" className="dense-inline-chip" label={`default: ${env.defaultBranch}`} />
                </Stack>
                <Stack className="dense-actions" direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                  <Button
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleEditEnv(env.envId);
                    }}
                  >
                    Edit
                  </Button>
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
            </Box>
          ))}
          {envs.length === 0 && (
            <Typography color="text.secondary" className="dense-empty-copy">
              No sources yet. Register one to make it available to tasks and runs.
            </Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export default EnvironmentList;
