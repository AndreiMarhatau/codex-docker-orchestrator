import { Button, Stack } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import SectionHeader from '../../components/SectionHeader.jsx';

function EnvironmentHeader({ envs, loading, openCreateDialog, refreshAll }) {
  return (
    <SectionHeader
      eyebrow="Sources"
      icon={<FolderOpenOutlinedIcon fontSize="small" />}
      title="Environments"
      description="Create and manage repo sources for Codex runs."
      chips={[
        { label: `${envs.length} environments`, tone: 'neutral' }
      ]}
      actions={(
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button variant="contained" size="small" onClick={openCreateDialog}>
            New source
          </Button>
          <Button variant="outlined" size="small" onClick={refreshAll} disabled={loading}>
            Sync now
          </Button>
        </Stack>
      )}
    />
  );
}

export default EnvironmentHeader;
