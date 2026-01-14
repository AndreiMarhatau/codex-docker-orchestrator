import { Box, Button, Stack, Typography } from '@mui/material';
import { apiUrlWithPassword } from '../../../../../api.js';
import { formatBytes } from '../../../../formatters.js';
import { encodeArtifactPath, isImageArtifact } from '../../../../task-helpers.js';

function RunArtifacts({ run, taskId }) {
  const artifacts = run.artifacts || [];

  const renderArtifactCard = (artifact, showImage) => {
    const encodedPath = encodeArtifactPath(artifact.path);
    const artifactUrl = apiUrlWithPassword(
      `/api/tasks/${taskId}/artifacts/${run.runId}/${encodedPath}`
    );
    return (
      <Box key={artifact.path} className="artifact-item">
        {showImage && (
          <img className="artifact-image" src={artifactUrl} alt={artifact.path} />
        )}
        <Stack spacing={1}>
          <Typography className="mono">{artifact.path}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography color="text.secondary" variant="caption">
              {formatBytes(artifact.size)}
            </Typography>
            <Button
              component="a"
              href={artifactUrl}
              target="_blank"
              rel="noreferrer"
              size="small"
              variant="outlined"
            >
              Open
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  };

  const imageArtifacts = artifacts.filter((artifact) => isImageArtifact(artifact.path));
  const fileArtifacts = artifacts.filter((artifact) => !isImageArtifact(artifact.path));

  return (
    <Box component="details" className="log-entry">
      <summary className="log-summary">
        <span>Artifacts</span>
        <span className="log-meta">{artifacts.length}</span>
      </summary>
      <Box sx={{ mt: 1 }}>
        {artifacts.length === 0 && (
          <Typography color="text.secondary">No artifacts for this run.</Typography>
        )}
        {artifacts.length > 0 && imageArtifacts.length > 0 && fileArtifacts.length > 0 && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">Images</Typography>
              <Box className="artifact-grid">
                {imageArtifacts.map((artifact) => renderArtifactCard(artifact, true))}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">Files</Typography>
              <Box className="artifact-list">
                {fileArtifacts.map((artifact) => renderArtifactCard(artifact, false))}
              </Box>
            </Box>
          </Stack>
        )}
        {artifacts.length > 0 && !(imageArtifacts.length > 0 && fileArtifacts.length > 0) && (
          <Box className="artifact-grid">
            {artifacts.map((artifact) => renderArtifactCard(artifact, isImageArtifact(artifact.path)))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default RunArtifacts;
