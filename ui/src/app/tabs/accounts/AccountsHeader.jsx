import { Button } from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import SectionHeader from '../../components/SectionHeader.jsx';

function AccountsHeader({ accountsState, data }) {
  const { loading } = data;

  return (
    <SectionHeader
      eyebrow="Access"
      icon={<AccountCircleOutlinedIcon fontSize="small" />}
      title="Accounts"
      description="Manage the active Codex accounts, rotation order, and usage headroom across the orchestrator."
      chips={[
        { label: `${data.accountState.accounts.length} accounts`, tone: 'neutral' },
        {
          label: accountsState.activeAccount ? `Active ${accountsState.activeAccount.label}` : 'No active account',
          tone: accountsState.activeAccount ? 'live' : 'muted'
        }
      ]}
      actions={(
        <Button
          size="small"
          variant="outlined"
          onClick={() => accountsState.refreshAccounts()}
          disabled={loading}
        >
          Refresh
        </Button>
      )}
    />
  );
}

export default AccountsHeader;
