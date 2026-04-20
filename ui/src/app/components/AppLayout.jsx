/* eslint-disable complexity */
import { useEffect, useState } from 'react';
import { Box, Stack, Tab, Tabs, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
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
  const theme = useTheme();
  const compactTabs = useMediaQuery(theme.breakpoints.down('sm'));
  const { activeTab, setActiveTab } = tabState;
  const { error, setupState } = data;
  const { handleBackToTasks, selectedTaskId } = tasksState.selection;
  const locked = !authState.isUnlocked;
  const setupReady = Boolean(setupState?.ready);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderScrolled(window.scrollY > 16);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeLabel = ['Environments', selectedTaskId ? 'Task Workspace' : 'Tasks', 'Accounts', 'Settings'][activeTab];

  return (
    <Box className={`app-shell${locked ? ' app-shell-locked' : ''}`}>
      <Box className={`app-header${headerScrolled ? ' app-header-scrolled' : ''}`}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ flexWrap: 'wrap' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" className="app-brand">
            <Box className="app-brand-mark">
              <AutoAwesomeOutlinedIcon fontSize="small" />
            </Box>
            <Stack spacing={0.3}>
              <Typography className="app-brand-title">
                Codex Orchestrator
              </Typography>
              <Typography className="app-brand-subtitle">
                {activeLabel}
              </Typography>
            </Stack>
          </Stack>
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
              '.MuiTab-root': {
                minWidth: 'auto'
              }
            }}
          >
            <Tab
              icon={<FolderOpenOutlinedIcon />}
              iconPosition={compactTabs ? 'top' : 'start'}
              label={compactTabs ? '' : 'Environments'}
              aria-label="Environments"
              disabled={locked || !setupReady}
            />
            <Tab
              icon={<ListAltOutlinedIcon />}
              iconPosition={compactTabs ? 'top' : 'start'}
              label={compactTabs ? '' : 'Tasks'}
              aria-label="Tasks"
              onClick={() => {
                if (activeTab === 1 && selectedTaskId) {
                  handleBackToTasks();
                }
              }}
              disabled={locked || !setupReady}
            />
            <Tab
              icon={<AccountCircleOutlinedIcon />}
              iconPosition={compactTabs ? 'top' : 'start'}
              label={compactTabs ? '' : 'Accounts'}
              aria-label="Accounts"
              disabled={locked}
            />
            <Tab
              icon={<SettingsOutlinedIcon />}
              iconPosition={compactTabs ? 'top' : 'start'}
              label={compactTabs ? '' : 'Settings'}
              aria-label="Settings"
              disabled={locked}
            />
          </Tabs>
        </Stack>
      </Box>

      <Box className="app-main">
        {activeTab === 0 && (setupReady ? (
          <EnvironmentsTab data={data} envState={envState} />
        ) : (
          <Box className="workspace-empty">
            <Typography>Finish setup in Settings and add a Codex account to enable environments.</Typography>
          </Box>
        ))}
        {activeTab === 1 && (setupReady ? (
          <TasksTab data={data} tasksState={tasksState} />
        ) : (
          <Box className="workspace-empty">
            <Typography>Finish setup in Settings and add a Codex account to enable tasks.</Typography>
          </Box>
        ))}
        {activeTab === 2 && <AccountsTab accountsState={accountsState} data={data} />}
        {activeTab === 3 && <SettingsTab authState={authState} refreshAll={data.refreshAll} setupState={setupState} />}
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
