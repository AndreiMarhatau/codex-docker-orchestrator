import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

function getGitStatusDisplay(gitStatus) {
  if (!gitStatus) {
    return null;
  }
  const dirtyNote =
    gitStatus.dirty === true ? 'Uncommitted changes in worktree.' : 'Working tree clean.';
  if (gitStatus.hasChanges === false) {
    return {
      label: 'Clean',
      icon: CheckCircleOutlineIcon,
      color: 'success',
      tone: 'clean',
      tooltip: `No changes since base commit. ${dirtyNote}`
    };
  }
  if (gitStatus.dirty === true) {
    return {
      label: 'Uncommitted',
      icon: EditNoteOutlinedIcon,
      color: 'info',
      tone: 'dirty',
      tooltip: `Worktree has uncommitted changes. ${dirtyNote}`
    };
  }
  if (gitStatus.pushed === true) {
    return {
      label: 'Pushed',
      icon: CloudDoneOutlinedIcon,
      color: 'info',
      tone: 'pushed',
      tooltip: `Remote branch matches HEAD. ${dirtyNote}`
    };
  }
  if (gitStatus.pushed === false) {
    return {
      label: 'Committed',
      icon: CloudUploadOutlinedIcon,
      color: 'secondary',
      tone: 'unpushed',
      tooltip: `Local commits not on origin. ${dirtyNote}`
    };
  }
  return {
    label: 'Git unknown',
    icon: HelpOutlineIcon,
    color: 'default',
    tone: 'unknown',
    tooltip: 'Unable to read git status.'
  };
}

export { getGitStatusDisplay };
