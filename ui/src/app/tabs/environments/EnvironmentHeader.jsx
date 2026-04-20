import { Button } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import SectionHeader from '../../components/SectionHeader.jsx';
import { formatRepoDisplay } from '../../repo-helpers.js';

function EnvironmentHeader({ envs, loading, refreshAll, selectedEnv }) {
  return (
    <SectionHeader
      eyebrow="Sources"
      icon={<FolderOpenOutlinedIcon fontSize="small" />}
      title="Environments"
      description="Create and manage repo sources for Codex runs."
      chips={[
        { label: `${envs.length} environments`, tone: 'neutral' },
        {
          label: `Selected ${selectedEnv ? formatRepoDisplay(selectedEnv.repoUrl) : 'none'}`,
          tone: 'muted',
          variant: 'outlined'
        }
      ]}
      actions={(
        <Button variant="outlined" size="small" onClick={refreshAll} disabled={loading}>
          Sync now
        </Button>
      )}
    />
  );
}

export default EnvironmentHeader;
