import { Box, Card, CardContent, Tab, Tabs, Typography } from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AccountsTab from '../tabs/AccountsTab.jsx';
import EnvironmentsTab from '../tabs/EnvironmentsTab.jsx';
import SettingsTab from '../tabs/SettingsTab.jsx';
import TasksTab from '../tabs/TasksTab.jsx';

function AppLayout({ accountsState, data, envState, tabState, tasksState }) {
  const { activeTab, setActiveTab } = tabState;
  const { error } = data;
  const { handleBackToTasks, selectedTaskId } = tasksState.selection;

  return (
    <Box className="app-shell">
      <Tabs
        value={activeTab}
        onChange={(event, value) => setActiveTab(value)}
        textColor="primary"
        indicatorColor="primary"
        aria-label="Orchestrator sections"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          alignSelf: 'flex-start',
          maxWidth: '100%',
          '.MuiTabs-flexContainer': {
            gap: 1
          },
          '.MuiTab-root': {
            minWidth: 'auto'
          }
        }}
      >
        <Tab icon={<FolderOpenOutlinedIcon />} iconPosition="start" label="Environments" />
        <Tab
          icon={<ListAltOutlinedIcon />}
          iconPosition="start"
          label="Tasks"
          onClick={() => {
            if (activeTab === 1 && selectedTaskId) {
              handleBackToTasks();
            }
          }}
        />
        <Tab icon={<AccountCircleOutlinedIcon />} iconPosition="start" label="Accounts" />
        <Tab icon={<SettingsOutlinedIcon />} iconPosition="start" label="Settings" />
      </Tabs>

      {activeTab === 0 && <EnvironmentsTab data={data} envState={envState} />}
      {activeTab === 1 && <TasksTab data={data} envState={envState} tasksState={tasksState} />}
      {activeTab === 2 && <AccountsTab accountsState={accountsState} data={data} />}
      {activeTab === 3 && <SettingsTab />}

      {error && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default AppLayout;
