import { Box, Tooltip } from '@mui/material';
import { STATUS_CONFIG } from '../../constants.js';
import { getGitStatusDisplay } from '../../git-helpers.js';

function StatusPill({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;

  return (
    <Box className={`status-pill status-pill--${status || 'unknown'}`}>
      <span className="status-pill-dot" style={{ backgroundColor: config.border }} />
      <span>{config.label}</span>
    </Box>
  );
}

function GitStatusPill({ gitStatus, withTooltip = true }) {
  const gitStatusDisplay = getGitStatusDisplay(gitStatus);
  const GitIcon = gitStatusDisplay?.icon;

  if (!gitStatusDisplay || !GitIcon) {
    return null;
  }

  const pill = (
    <Box className={`git-state-pill git-state-pill--${gitStatusDisplay.tone || 'unknown'}`}>
      <GitIcon fontSize="inherit" />
      <span>{gitStatusDisplay.label}</span>
    </Box>
  );

  if (!withTooltip) {
    return pill;
  }

  return (
    <Tooltip title={gitStatusDisplay.tooltip}>
      {pill}
    </Tooltip>
  );
}

function GitDiffStats({ gitStatus }) {
  const additions = gitStatus?.diffStats?.additions ?? 0;
  const deletions = gitStatus?.diffStats?.deletions ?? 0;

  return (
    <Box className="task-diff-stats" aria-label={`Changes +${additions} -${deletions}`}>
      <span className="diff-add">+{additions}</span>
      <span className="diff-del">-{deletions}</span>
    </Box>
  );
}

export { GitDiffStats, GitStatusPill, StatusPill };
