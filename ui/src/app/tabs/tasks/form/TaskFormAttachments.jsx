import { Button, Chip, Stack, Typography } from '@mui/material';
import { formatBytes } from '../../../formatters.js';

function TaskFormAttachments({ images, loading, maxImages }) {
  return (
    <>
      <Typography variant="subtitle2">Attachments</Typography>
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
          <Button
            variant="outlined"
            component="label"
            disabled={
              loading || images.taskImageUploading || images.taskImages.length >= maxImages
            }
          >
            Add images
            <input
              ref={images.taskImageInputRef}
              type="file"
              hidden
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
              onChange={images.handleTaskImagesSelected}
            />
          </Button>
          <Typography color="text.secondary">
            Up to {maxImages} images, used only for the initial request.
          </Typography>
        </Stack>
        {images.taskImageError && <Typography color="error">{images.taskImageError}</Typography>}
        {images.taskImages.length > 0 && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {images.taskImages.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  label={`${file.name} (${formatBytes(file.size)})`}
                  onDelete={() => images.handleRemoveTaskImage(index)}
                />
              ))}
            </Stack>
            <Button
              size="small"
              color="secondary"
              onClick={images.handleClearTaskImages}
              disabled={loading || images.taskImageUploading}
            >
              Clear images
            </Button>
          </Stack>
        )}
      </Stack>
    </>
  );
}

export default TaskFormAttachments;
