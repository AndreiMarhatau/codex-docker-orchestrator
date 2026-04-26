import { Box, Link, Stack, Typography } from '@mui/material';
import { apiUrlWithPassword } from '../../../../../api.js';
import DisclosureSection from '../../../../components/DisclosureSection.jsx';
import { formatBytes } from '../../../../formatters.js';
import { encodeArtifactPath, isImageArtifact } from '../../../../task-helpers.js';

function RunArtifacts({ defaultOpen = false, run, taskId }) {
  const artifacts = run.artifacts || [];

  if (artifacts.length === 0) {
    return null;
  }

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
      defaultOpen={defaultOpen}
      title={`Artifacts ${artifacts.length}`}
    >
      <Box>
        {imageArtifacts.length > 0 && fileArtifacts.length > 0 && (
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
        {!(imageArtifacts.length > 0 && fileArtifacts.length > 0) && (
          <Box className="artifact-list">
            {artifacts.map((artifact) => renderArtifactRow(artifact, isImageArtifact(artifact.path)))}
          </Box>
        )}
      </Box>
    </DisclosureSection>
  );
}

export default RunArtifacts;
