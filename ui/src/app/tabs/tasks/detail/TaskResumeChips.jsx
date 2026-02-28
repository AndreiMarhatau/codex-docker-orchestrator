import { Button, Chip, Stack, Typography } from '@mui/material';
import { emptyResumeConfig } from '../../../constants.js';
import { formatBytes } from '../../../formatters.js';
import { resolveModelValue, resolveReasoningEffortValue } from '../../../model-helpers.js';

const tagBaseSx = {
  height: 24,
  fontWeight: 600,
  borderRadius: '8px',
  '.MuiChip-label': { px: 1 },
  '.MuiChip-deleteIcon': { color: 'inherit', opacity: 0.92 },
  '.MuiChip-deleteIcon:hover': { color: 'inherit', opacity: 1 }
};

function ResumeActiveTags({ detail }) {
  const modelValue = resolveModelValue(detail.resumeConfig.modelChoice, detail.resumeConfig.customModel);
  const effortValue = resolveReasoningEffortValue(detail.resumeConfig);
  const branchLabel = detail.taskDetail?.branchName || 'current branch';
  const contextRepos = detail.resumeContextRepos
    .map((repo, index) => ({ ...repo, index }))
    .filter((repo) => repo.envId);

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      <Chip label={branchLabel} size="small" sx={{ ...tagBaseSx, bgcolor: '#e0f2fe', color: '#0c4a6e' }} />
      {Boolean(modelValue || effortValue) && (
        <Chip
          label={`${modelValue || 'default'}${effortValue ? ` • ${effortValue}` : ''}`}
          size="small"
          onDelete={() => detail.setResumeConfig(emptyResumeConfig)}
          sx={{ ...tagBaseSx, bgcolor: '#ede9fe', color: '#4c1d95' }}
        />
      )}
      {detail.resumeUseHostDockerSocket && (
        <Chip
          label="docker"
          size="small"
          onDelete={() => {
            detail.setResumeUseHostDockerSocket(false);
            detail.setResumeDockerTouched(true);
          }}
          sx={{ ...tagBaseSx, bgcolor: '#dcfce7', color: '#14532d' }}
        />
      )}
      {contextRepos.map((entry) => (
        <Chip
          key={`resume-context-${entry.index}`}
          label={`${entry.envId}${entry.ref ? ` (${entry.ref})` : ''}`}
          size="small"
          onDelete={() => detail.handleRemoveResumeContextRepo(entry.index)}
          sx={{ ...tagBaseSx, bgcolor: '#fef3c7', color: '#78350f' }}
        />
      ))}
    </Stack>
  );
}

function ResumeExistingAttachments({ detail }) {
  const attachments = detail.taskDetail?.attachments || [];
  if (attachments.length === 0) {
    return null;
  }
  return (
    <Stack spacing={0.75}>
      <Typography color="text.secondary" variant="body2">
        Existing files
      </Typography>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {attachments.map((file) => {
          const pendingRemoval = detail.resumeAttachmentRemovals.includes(file.name);
          return (
            <Chip
              key={file.name}
              clickable
              label={`${file.originalName || file.name} (${formatBytes(file.size)})`}
              size="small"
              onClick={() => detail.toggleResumeAttachmentRemoval(file.name)}
              sx={{
                ...tagBaseSx,
                bgcolor: pendingRemoval ? '#fee2e2' : '#e5e7eb',
                color: pendingRemoval ? '#991b1b' : '#111827',
                textDecoration: pendingRemoval ? 'line-through' : 'none'
              }}
            />
          );
        })}
      </Stack>
      <Typography color="text.secondary" variant="caption">
        Tap a file to mark for deletion. Tap again to keep it.
      </Typography>
    </Stack>
  );
}

function ResumeNewAttachments({ detail, loading }) {
  return (
    <Stack spacing={0.75}>
      <Typography color="text.secondary" variant="body2">
        New files for this run
      </Typography>
      {detail.resumeFiles.taskFiles.length === 0 && (
        <Typography color="text.secondary" variant="caption">
          No new files added.
        </Typography>
      )}
      {detail.resumeFiles.taskFiles.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {detail.resumeFiles.taskFiles.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              label={`${file.name} (${formatBytes(file.size)})`}
              size="small"
              onDelete={() => detail.resumeFiles.handleRemoveTaskFile(index)}
              sx={{ ...tagBaseSx, bgcolor: '#dbeafe', color: '#1e3a8a' }}
            />
          ))}
        </Stack>
      )}
      {detail.resumeFiles.taskFiles.length > 0 && (
        <Button
          size="small"
          color="secondary"
          onClick={detail.resumeFiles.handleClearTaskFiles}
          disabled={loading || detail.resumeFiles.taskFileUploading}
        >
          Clear new files
        </Button>
      )}
    </Stack>
  );
}

export { ResumeActiveTags, ResumeExistingAttachments, ResumeNewAttachments };
