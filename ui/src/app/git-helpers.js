import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

function getGitStatusDisplay(gitStatus) {
  if (!gitStatus) {
    return null;
  }
  const dirtyNote =
    gitStatus.dirty === true ? 'Uncommitted changes in worktree.' : 'Working tree clean.';
  if (gitStatus.hasChanges === false) {
    return {
      label: 'No changes',
      icon: CheckCircleOutlineIcon,
      color: 'success',
      tooltip: `No changes since base commit. ${dirtyNote}`
    };
  }
  if (gitStatus.pushed === true) {
    return {
      label: 'Changes pushed',
      icon: CloudDoneOutlinedIcon,
      color: 'success',
      tooltip: `Remote branch matches HEAD. ${dirtyNote}`
    };
  }
  if (gitStatus.pushed === false) {
    return {
      label: 'Unpushed changes',
      icon: CloudUploadOutlinedIcon,
      color: 'warning',
      tooltip: `Local commits not on origin. ${dirtyNote}`
    };
  }
  return {
    label: 'Git status unknown',
    icon: HelpOutlineIcon,
    color: 'default',
    tooltip: 'Unable to read git status.'
  };
}

export { getGitStatusDisplay };
