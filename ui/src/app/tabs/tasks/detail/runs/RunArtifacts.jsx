import { Box, Link, Stack, Typography } from '@mui/material';
import { apiUrlWithPassword } from '../../../../../api.js';
import DisclosureSection from '../../../../components/DisclosureSection.jsx';
import { formatBytes } from '../../../../formatters.js';
import { encodeArtifactPath, isImageArtifact } from '../../../../task-helpers.js';

function RunArtifacts({ run, taskId }) {
  const artifacts = run.artifacts || [];

  const renderArtifactRow = (artifact, showImage) => {
    const artifactUrl =
      artifact.url ||
      apiUrlWithPassword(`/api/tasks/${taskId}/artifacts/${run.runId}/${encodeArtifactPath(artifact.path)}`);
    return (
      <Box key={artifact.path} className={`artifact-item${showImage ? ' artifact-item--image' : ''}`}>
        {showImage && (
          <img className="artifact-image" src={artifactUrl} alt={artifact.path} />
        )}
        <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
          <Typography className="mono" sx={{ overflowWrap: 'anywhere' }}>{artifact.path}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Typography color="text.secondary" variant="caption">{formatBytes(artifact.size)}</Typography>
            <Link href={artifactUrl} target="_blank" rel="noreferrer" underline="hover" className="artifact-link">
              Open
            </Link>
          </Stack>
        </Stack>
      </Box>
    );
  };

  const imageArtifacts = artifacts.filter((artifact) => isImageArtifact(artifact.path));
  const fileArtifacts = artifacts.filter((artifact) => !isImageArtifact(artifact.path));

  return (
    <DisclosureSection
      className="run-section-card run-section-card--artifacts agent-inline-summary agent-inline-summary--subtle"
      title={`Artifacts${artifacts.length ? ` ${artifacts.length}` : ''}`}
    >
      <Box>
        {artifacts.length === 0 && (
          <Typography color="text.secondary">No artifacts for this run.</Typography>
        )}
        {artifacts.length > 0 && imageArtifacts.length > 0 && fileArtifacts.length > 0 && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">Images</Typography>
              <Box className="artifact-list">{imageArtifacts.map((artifact) => renderArtifactRow(artifact, true))}</Box>
            </Box>
            <Box>
              <Typography variant="subtitle2">Files</Typography>
              <Box className="artifact-list">
                {fileArtifacts.map((artifact) => renderArtifactRow(artifact, false))}
              </Box>
            </Box>
          </Stack>
        )}
        {artifacts.length > 0 && !(imageArtifacts.length > 0 && fileArtifacts.length > 0) && (
          <Box className="artifact-list">
            {artifacts.map((artifact) => renderArtifactRow(artifact, isImageArtifact(artifact.path)))}
          </Box>
        )}
      </Box>
    </DisclosureSection>
  );
}

export default RunArtifacts;
