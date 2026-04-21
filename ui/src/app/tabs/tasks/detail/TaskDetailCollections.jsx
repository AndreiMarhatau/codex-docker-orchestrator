import { Box, Stack, Typography } from '@mui/material';
import { formatBytes } from '../../../formatters.js';
import { formatRepoDisplay } from '../../../repo-helpers.js';
import DisclosureSection from '../../../components/DisclosureSection.jsx';

function DetailList({ emptyLabel, items }) {
  if (items.length === 0) {
    return (
      <Box className="detail-list-empty">
        <Typography color="text.secondary">{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      {items.map((item) => (
        <Box key={item.key} className="detail-list-item">
          <Stack spacing={0.45}>
            <Typography className="detail-list-title">{item.title}</Typography>
            {item.subtitle ? (
              <Typography color="text.secondary" variant="body2">
                {item.subtitle}
              </Typography>
            ) : null}
          </Stack>
          {item.meta?.length > 0 ? (
            <Box className="detail-meta-inline detail-meta-inline--compact">
              {item.meta.map((value) => (
                <span key={`${item.key}-${value}`} className="detail-meta-inline-item">{value}</span>
              ))}
            </Box>
          ) : null}
          {item.path ? (
            <Typography className="mono" color="text.secondary">
              {item.path}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

function buildGeneratedArtifacts(taskDetail) {
  return (taskDetail.runLogs || []).flatMap((run) =>
    (run.artifacts || []).map((artifact, index) => ({
      key: `${run.runId}-${artifact.path}-${index}`,
      title: artifact.path.split('/').pop() || artifact.path,
      subtitle: `from ${run.runId}`,
      meta: [formatBytes(artifact.size)],
      path: artifact.path
    }))
  );
}

function buildAttachmentItems(taskDetail) {
  return (taskDetail.attachments || []).map((file, index) => ({
    key: `${file.name || 'file'}-${index}`,
    title: file.originalName || file.name,
    subtitle: Number.isFinite(file.size) ? formatBytes(file.size) : '',
    meta: Number.isFinite(file.size) ? [formatBytes(file.size)] : [],
    path: file.path || ''
  }));
}

function buildContextRepoItems(taskDetail) {
  return (taskDetail.contextRepos || []).map((repo, index) => ({
    key: `${repo.envId || repo.repoUrl || 'repo'}-${index}`,
    title: formatRepoDisplay(repo.repoUrl) || repo.repoUrl || repo.envId,
    subtitle: repo.ref ? `ref ${repo.ref}` : '',
    meta: repo.ref ? [`ref ${repo.ref}`] : [],
    path: repo.worktreePath || ''
  }));
}

function TaskDetailCollections({
  includeOutputs = true,
  includeTaskFiles = true,
  includeReferenceRepos = true,
  onlyNonEmpty = false,
  taskDetail
}) {
  const generatedArtifacts = buildGeneratedArtifacts(taskDetail);
  const attachmentItems = buildAttachmentItems(taskDetail);
  const contextRepoItems = buildContextRepoItems(taskDetail);
  const sections = [
    includeOutputs
      ? {
          title: 'Outputs',
          meta: `${generatedArtifacts.length}`,
          emptyLabel: 'No outputs generated yet.',
          items: generatedArtifacts
        }
      : null,
    includeTaskFiles
      ? {
          title: 'Task files',
          meta: `${attachmentItems.length}`,
          emptyLabel: 'No task files attached.',
          items: attachmentItems
        }
      : null,
    includeReferenceRepos
      ? {
          title: 'Reference repos',
          meta: `${contextRepoItems.length}`,
          emptyLabel: 'No reference repos attached.',
          items: contextRepoItems
        }
      : null
  ].filter(Boolean);

  const visibleSections = onlyNonEmpty
    ? sections.filter((section) => section.items.length > 0)
    : sections;

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      {visibleSections.map((section) => (
        <DisclosureSection key={section.title} title={section.title} meta={section.meta} className="detail-disclosure">
          <DetailList emptyLabel={section.emptyLabel} items={section.items} />
        </DisclosureSection>
      ))}
    </Stack>
  );
}

export { DetailList, buildAttachmentItems, buildContextRepoItems, buildGeneratedArtifacts };
export default TaskDetailCollections;
