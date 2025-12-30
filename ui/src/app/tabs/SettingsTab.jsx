import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { formatTimestamp } from '../formatters.js';

function SettingsTab({ settingsState }) {
  const { imageInfo, imageLoading, imageUpdating, refreshImageInfo, handlePullImage } = settingsState;

  return (
    <Box className="section-shell fade-in">
      <Stack spacing={2}>
        <Card className="panel-card">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Typography variant="h6" className="panel-title">
                  Codex Docker Image
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => refreshImageInfo()}
                  disabled={imageLoading || imageUpdating}
                >
                  Refresh
                </Button>
              </Stack>
              {imageLoading && (
                <Typography color="text.secondary">Loading image details...</Typography>
              )}
              {!imageLoading && (
                <Stack spacing={1}>
                  <Typography>
                    Image: <span className="mono">{imageInfo?.imageName || 'unknown'}</span>
                  </Typography>
                  <Typography>Created: {formatTimestamp(imageInfo?.imageCreatedAt)}</Typography>
                  {imageInfo?.imageId && (
                    <Typography className="mono">ID: {imageInfo.imageId}</Typography>
                  )}
                  {imageInfo && imageInfo.present === false && (
                    <Typography color="text.secondary">
                      Image not found locally. Pull to download it.
                    </Typography>
                  )}
                </Stack>
              )}
              <Button variant="contained" onClick={handlePullImage} disabled={imageUpdating}>
                {imageUpdating ? 'Updating image...' : 'Update image'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default SettingsTab;
