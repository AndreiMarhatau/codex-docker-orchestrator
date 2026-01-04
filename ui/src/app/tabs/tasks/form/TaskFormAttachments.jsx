import { Button, Chip, Stack, Typography } from '@mui/material';
import { formatBytes } from '../../../formatters.js';

function TaskFormAttachments({ files, images, loading, maxFiles, maxImages }) {
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
          <Button
            variant="outlined"
            component="label"
            disabled={loading || files.taskFileUploading || files.taskFiles.length >= maxFiles}
          >
            Add files
            <input
              ref={files.taskFileInputRef}
              type="file"
              hidden
              multiple
              onChange={files.handleTaskFilesSelected}
            />
          </Button>
          <Typography color="text.secondary">
            Up to {maxFiles} files, mounted read-only for the task duration.
          </Typography>
        </Stack>
        {images.taskImageError && <Typography color="error">{images.taskImageError}</Typography>}
        {files.taskFileError && <Typography color="error">{files.taskFileError}</Typography>}
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
        {files.taskFiles.length > 0 && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {files.taskFiles.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  label={`${file.name} (${formatBytes(file.size)})`}
                  onDelete={() => files.handleRemoveTaskFile(index)}
                />
              ))}
            </Stack>
            <Button
              size="small"
              color="secondary"
              onClick={files.handleClearTaskFiles}
              disabled={loading || files.taskFileUploading}
            >
              Clear files
            </Button>
          </Stack>
        )}
      </Stack>
    </>
  );
}

export default TaskFormAttachments;
