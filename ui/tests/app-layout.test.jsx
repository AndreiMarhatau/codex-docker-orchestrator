import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from './test-utils.jsx';
import AppLayout from '../src/app/components/AppLayout.jsx';

const useMediaQueryMock = vi.fn();

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useMediaQuery: (...args) => useMediaQueryMock(...args)
  };
});

vi.mock('../src/app/tabs/AccountsTab.jsx', () => ({
  __esModule: true,
  default: () => <div>accounts panel</div>
}));

vi.mock('../src/app/tabs/EnvironmentsTab.jsx', () => ({
  __esModule: true,
  default: () => <div>environments panel</div>
}));

vi.mock('../src/app/tabs/SettingsTab.jsx', () => ({
  __esModule: true,
  default: () => <div>settings panel</div>
}));

vi.mock('../src/app/tabs/TasksTab.jsx', () => ({
  __esModule: true,
  default: () => <div>tasks panel</div>
}));

vi.mock('../src/app/components/AuthGate.jsx', () => ({
  __esModule: true,
  default: () => <div>auth gate</div>
}));

function renderLayout({
  activeTab: initialActiveTab = 1,
  mobile = false,
  selectedTaskId = '',
  setupReady = true,
  unlocked = true
} = {}) {
  useMediaQueryMock.mockReturnValue(mobile);
  const handleBackToTasks = vi.fn();

  function Harness() {
    const [activeTab, setActiveTab] = useState(initialActiveTab);

    return (
      <AppLayout
        accountsState={{}}
        authState={{ isUnlocked: unlocked }}
        data={{ error: '', refreshAll: vi.fn(), setupState: { ready: setupReady } }}
        envState={{}}
        tabState={{ activeTab, setActiveTab }}
        tasksState={{
          selection: { handleBackToTasks, selectedTaskId }
        }}
      />
    );
  }

  render(<Harness />);
  return { handleBackToTasks };
}

afterEach(() => {
  useMediaQueryMock.mockReset();
});

describe('AppLayout', () => {
  it('supports keyboard navigation across desktop tabs', () => {
    renderLayout();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tasks' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Accounts' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('accounts panel')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Accounts' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Settings' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Environments' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('environments panel')).toBeInTheDocument();
  });

  it('renders mobile navigation and respects disabled task tabs before setup', () => {
    renderLayout({ activeTab: 2, mobile: true, setupReady: false, unlocked: false });

    expect(screen.getByRole('tab', { name: 'Environments' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeDisabled();
    expect(screen.getByText('auth gate')).toBeInTheDocument();
  });

  it('returns from task detail when reselecting the active tasks tab', () => {
    const { handleBackToTasks } = renderLayout({ selectedTaskId: 'task-1' });

    fireEvent.click(screen.getByRole('tab', { name: 'Tasks' }));

    expect(handleBackToTasks).toHaveBeenCalled();
  });
});
