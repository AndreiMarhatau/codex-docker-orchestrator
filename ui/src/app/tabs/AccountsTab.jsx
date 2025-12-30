import { Box, Card, CardContent, Divider, Stack } from '@mui/material';
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
          <CardContent>
            <Stack spacing={2}>
              <AccountsHeader accountsState={accountsState} data={data} />
              <UsageLimits accountsState={accountsState} />
              <Divider />
              <RotationQueue accountsState={accountsState} data={data} />
              <Divider />
              <AccountForm accountsState={accountsState} data={data} />
              <Divider />
              <AccountList accountsState={accountsState} data={data} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default AccountsTab;
