import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccountsTab from '../tabs/AccountsTab.jsx';
import EnvironmentsTab from '../tabs/EnvironmentsTab.jsx';
import SettingsTab from '../tabs/SettingsTab.jsx';
import TasksTab from '../tabs/TasksTab.jsx';
import AuthGate from './AuthGate.jsx';
import { DesktopNavigation, MobileNavigation } from './AppNavigation.jsx';

function AppTabPanel({ activeTab, children, tab }) {
  return (
    <Box
      role="tabpanel"
      id={`app-tabpanel-${tab}`}
      aria-labelledby={`app-tab-${tab}`}
      hidden={activeTab !== tab}
    >
      {activeTab === tab && children}
    </Box>
  );
}

function AppLayout({ accountsState, authState, data, envState, tabState, tasksState }) {
  const theme = useTheme();
  const mobileNav = useMediaQuery(theme.breakpoints.down('sm'));
  const { activeTab, setActiveTab } = tabState;
  const { error, setupState } = data;
  const { handleBackToTasks, selectedTaskId } = tasksState.selection;
  const locked = !authState.isUnlocked;
  const setupReady = Boolean(setupState?.ready);

  const isNavDisabled = (item) =>
    locked || ((item.tab === 0 || item.tab === 1) && !setupReady);

  const handleNavSelect = (value) => {
    if (value === 1 && activeTab === 1 && selectedTaskId) {
      handleBackToTasks();
    }
    setActiveTab(value);
  };

  return (
    <Box className={`app-shell${locked ? ' app-shell-locked' : ''}`}>
      <Box className="app-frame">
        <Box className="app-header">
          {mobileNav ? (
            <MobileNavigation
              activeTab={activeTab}
              handleNavSelect={handleNavSelect}
              isNavDisabled={isNavDisabled}
            />
          ) : (
            <DesktopNavigation
              activeTab={activeTab}
              handleNavSelect={handleNavSelect}
              isNavDisabled={isNavDisabled}
            />
          )}
        </Box>

        <Box className="app-main">
          <AppTabPanel activeTab={activeTab} tab={0}>
            {setupReady ? (
              <EnvironmentsTab data={data} envState={envState} />
            ) : (
              <Box className="workspace-empty">
                <Typography>Finish setup in Settings and add a Codex account to enable environments.</Typography>
              </Box>
            )}
          </AppTabPanel>
          <AppTabPanel activeTab={activeTab} tab={1}>
            {setupReady ? (
              <TasksTab data={data} tasksState={tasksState} />
            ) : (
              <Box className="workspace-empty">
                <Typography>Finish setup in Settings and add a Codex account to enable tasks.</Typography>
              </Box>
            )}
          </AppTabPanel>
          <AppTabPanel activeTab={activeTab} tab={2}>
            <AccountsTab accountsState={accountsState} data={data} />
          </AppTabPanel>
          <AppTabPanel activeTab={activeTab} tab={3}>
            <SettingsTab
              authState={authState}
              refreshAll={data.refreshAll}
              setupState={setupState}
            />
          </AppTabPanel>
        </Box>
      </Box>

      {error && (
        <Box className="workspace-error">
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      {locked && <AuthGate authState={authState} />}
    </Box>
  );
}

export default AppLayout;
