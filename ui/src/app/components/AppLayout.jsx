import { Box, Card, CardContent, Tab, Tabs, Typography } from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AccountsTab from '../tabs/AccountsTab.jsx';
import EnvironmentsTab from '../tabs/EnvironmentsTab.jsx';
import AuthGate from './AuthGate.jsx';
import SettingsTab from '../tabs/SettingsTab.jsx';
import TasksTab from '../tabs/TasksTab.jsx';

function AppLayout({ accountsState, authState, data, envState, tabState, tasksState }) {
  const { activeTab, setActiveTab } = tabState;
  const { error, setupState } = data;
  const { handleBackToTasks, selectedTaskId } = tasksState.selection;
  const locked = !authState.isUnlocked;
  const setupReady = Boolean(setupState?.ready);

  return (
    <Box className={`app-shell${locked ? ' app-shell-locked' : ''}`}>
      <Box className="app-header">
        <Tabs
          className="app-tabs"
          value={activeTab}
          onChange={(event, value) => setActiveTab(value)}
          textColor="primary"
          indicatorColor="primary"
          aria-label="Orchestrator sections"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            maxWidth: '100%',
            '.MuiTabs-flexContainer': {
              gap: 0.75
            },
            '.MuiTab-root': {
              minWidth: 'auto'
            }
          }}
        >
          <Tab
            icon={<FolderOpenOutlinedIcon />}
            iconPosition="start"
            label="Environments"
            disabled={locked || !setupReady}
          />
          <Tab
            icon={<ListAltOutlinedIcon />}
            iconPosition="start"
            label="Tasks"
            onClick={() => {
              if (activeTab === 1 && selectedTaskId) {
                handleBackToTasks();
              }
            }}
            disabled={locked || !setupReady}
          />
          <Tab
            icon={<AccountCircleOutlinedIcon />}
            iconPosition="start"
            label="Accounts"
            disabled={locked}
          />
          <Tab
            icon={<SettingsOutlinedIcon />}
            iconPosition="start"
            label="Settings"
            disabled={locked}
          />
        </Tabs>
      </Box>

      <Box className="app-main">
        {activeTab === 0 && (setupReady ? (
          <EnvironmentsTab data={data} envState={envState} />
        ) : (
          <Card><CardContent><Typography>Finish setup in Settings and add a Codex account to enable environments.</Typography></CardContent></Card>
        ))}
        {activeTab === 1 && (setupReady ? (
          <TasksTab data={data} tasksState={tasksState} />
        ) : (
          <Card><CardContent><Typography>Finish setup in Settings and add a Codex account to enable tasks.</Typography></CardContent></Card>
        ))}
        {activeTab === 2 && <AccountsTab accountsState={accountsState} data={data} />}
        {activeTab === 3 && <SettingsTab authState={authState} refreshAll={data.refreshAll} setupState={setupState} />}
      </Box>

      {error && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}
      {locked && <AuthGate authState={authState} />}
    </Box>
  );
}

export default AppLayout;
