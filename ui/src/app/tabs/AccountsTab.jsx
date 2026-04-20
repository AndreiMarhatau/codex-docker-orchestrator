import { Box, Card, CardContent, Stack } from '@mui/material';
import AccountsHeader from './accounts/AccountsHeader.jsx';
import AccountForm from './accounts/AccountForm.jsx';
import AccountList from './accounts/AccountList.jsx';
import RotationQueue from './accounts/RotationQueue.jsx';
import UsageLimits from './accounts/UsageLimits.jsx';

function AccountsTab({ accountsState, data }) {
  return (
    <Box className="section-shell fade-in">
      <Stack spacing={2}>
        <Card className="panel-card">
          <CardContent className="panel-content">
            <Box className="accounts-grid">
              <Box className="accounts-grid-span">
                <AccountsHeader accountsState={accountsState} data={data} />
              </Box>
              <UsageLimits accountsState={accountsState} />
              <RotationQueue accountsState={accountsState} data={data} />
              <AccountForm accountsState={accountsState} data={data} />
              <Box className="accounts-grid-span">
                <AccountList accountsState={accountsState} data={data} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default AccountsTab;
