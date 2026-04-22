import { Box, IconButton, Stack } from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';

const NAV_ITEMS = [
  { label: 'Environments', tab: 0 },
  { label: 'Tasks', tab: 1 },
  { label: 'Accounts', tab: 2 },
  { label: 'Settings', tab: 3 }
];

function focusNavTab(tab) {
  if (typeof window === 'undefined') {
    return;
  }
  window.requestAnimationFrame(() => {
    document.getElementById(`app-tab-${tab}`)?.focus();
  });
}

function AppNavButton({
  activeTab,
  className,
  disabled,
  handleNavKeyDown,
  handleNavSelect,
  item
}) {
  return (
    <button
      type="button"
      className={`${className}${activeTab === item.tab ? ' is-active' : ''}`}
      disabled={disabled}
      onClick={() => handleNavSelect(item.tab)}
      onKeyDown={(event) => handleNavKeyDown(item.tab, event)}
      aria-current={activeTab === item.tab ? 'page' : undefined}
      aria-controls={`app-tabpanel-${item.tab}`}
      id={`app-tab-${item.tab}`}
      role="tab"
      aria-selected={activeTab === item.tab}
      tabIndex={activeTab === item.tab ? 0 : -1}
    >
      {item.label}
    </button>
  );
}

function createNavKeyHandler(activeTab, handleNavSelect, isNavDisabled) {
  return (currentTab, event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const enabledTabs = NAV_ITEMS.filter((item) => !isNavDisabled(item));
    if (enabledTabs.length === 0) {
      return;
    }
    if (event.key === 'Home') {
      handleNavSelect(enabledTabs[0].tab);
      focusNavTab(enabledTabs[0].tab);
      return;
    }
    if (event.key === 'End') {
      handleNavSelect(enabledTabs[enabledTabs.length - 1].tab);
      focusNavTab(enabledTabs[enabledTabs.length - 1].tab);
      return;
    }
    const currentIndex = Math.max(
      0,
      enabledTabs.findIndex((item) => item.tab === currentTab)
    );
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + enabledTabs.length) % enabledTabs.length;
    const nextTab = enabledTabs[nextIndex].tab;
    handleNavSelect(nextTab);
    focusNavTab(nextTab);
  };
}

function DesktopNavigation({ activeTab, handleNavSelect, isNavDisabled }) {
  const handleNavKeyDown = createNavKeyHandler(activeTab, handleNavSelect, isNavDisabled);

  return (
    <Box className="app-nav-desktop">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={2.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Box className="app-logo-mark" aria-hidden="true">
            <TerminalOutlinedIcon fontSize="small" />
          </Box>
          <Stack direction="row" spacing={0.25} className="app-nav-links" role="tablist">
            {NAV_ITEMS.map((item) => (
              <AppNavButton
                key={item.label}
                activeTab={activeTab}
                className="app-nav-link"
                disabled={isNavDisabled(item)}
                handleNavKeyDown={handleNavKeyDown}
                handleNavSelect={handleNavSelect}
                item={item}
              />
            ))}
          </Stack>
        </Stack>
        <IconButton className="app-profile-button" aria-label="Profile" size="small">
          <AccountCircleOutlinedIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}

function MobileNavigation({ activeTab, handleNavSelect, isNavDisabled }) {
  const handleNavKeyDown = createNavKeyHandler(activeTab, handleNavSelect, isNavDisabled);

  return (
    <Box className="app-nav-mobile">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        className="app-mobile-topbar"
      >
        <IconButton className="app-mobile-icon" aria-label="Menu" size="small">
          <MenuOutlinedIcon fontSize="small" />
        </IconButton>
        <Box className="app-logo-mark app-logo-mark--mobile" aria-hidden="true">
          <TerminalOutlinedIcon fontSize="small" />
        </Box>
        <IconButton className="app-profile-button" aria-label="Profile" size="small">
          <AccountCircleOutlinedIcon />
        </IconButton>
      </Stack>
      <Stack direction="row" justifyContent="space-between" className="app-mobile-tabs" role="tablist">
        {NAV_ITEMS.map((item) => (
          <AppNavButton
            key={item.label}
            activeTab={activeTab}
            className="app-mobile-tab"
            disabled={isNavDisabled(item)}
            handleNavKeyDown={handleNavKeyDown}
            handleNavSelect={handleNavSelect}
            item={item}
          />
        ))}
      </Stack>
    </Box>
  );
}

export { DesktopNavigation, MobileNavigation };
