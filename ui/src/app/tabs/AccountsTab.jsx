import { Box, Stack } from '@mui/material';
import AccountsHeader from './accounts/AccountsHeader.jsx';
import AccountForm from './accounts/AccountForm.jsx';
import AccountList from './accounts/AccountList.jsx';
import RotationQueue from './accounts/RotationQueue.jsx';
import UsageLimits from './accounts/UsageLimits.jsx';

function AccountsTab({ accountsState, data }) {
  return (
    <Box className="section-shell dense-workstation-tab dense-workstation-tab--accounts fade-in">
      <Stack spacing={1.5}>
        <Box className="dense-tab-header">
          <AccountsHeader accountsState={accountsState} data={data} />
        </Box>
        <Stack spacing={1.5}>
          <UsageLimits accountsState={accountsState} />
          <RotationQueue accountsState={accountsState} data={data} />
          <AccountForm accountsState={accountsState} data={data} />
          <AccountList accountsState={accountsState} data={data} />
        </Stack>
      </Stack>
    </Box>
  );
}

export default AccountsTab;
