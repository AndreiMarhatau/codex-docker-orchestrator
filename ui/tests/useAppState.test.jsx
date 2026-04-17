import { render, waitFor } from './test-utils.jsx';
import { vi } from 'vitest';

const mockUseAccountsState = vi.fn();
const mockUseActiveTab = vi.fn();
const mockUseAppData = vi.fn();
const mockUseAuthState = vi.fn();
const mockUseEnvironmentState = vi.fn();
const mockUseStateStream = vi.fn();
const mockUseTasksState = vi.fn();

vi.mock('../src/app/hooks/useAccountsState.js', () => ({
  default: (...args) => mockUseAccountsState(...args)
}));

vi.mock('../src/app/hooks/useActiveTab.js', () => ({
  default: (...args) => mockUseActiveTab(...args)
}));

vi.mock('../src/app/hooks/useAppData.js', () => ({
  default: (...args) => mockUseAppData(...args)
}));

vi.mock('../src/app/hooks/useAuthState.js', () => ({
  default: (...args) => mockUseAuthState(...args)
}));

vi.mock('../src/app/hooks/useEnvironmentState.js', () => ({
  default: (...args) => mockUseEnvironmentState(...args)
}));

vi.mock('../src/app/hooks/useStateStream.js', () => ({
  default: (...args) => mockUseStateStream(...args)
}));

vi.mock('../src/app/hooks/useTasksState.js', () => ({
  default: (...args) => mockUseTasksState(...args)
}));

import useAppState from '../src/app/hooks/useAppState.js';

function AppStateProbe() {
  useAppState();
  return null;
}

it('keeps the selected task id when the app is locked', async () => {
  const setSelectedTaskId = vi.fn();
  const setTaskDetail = vi.fn();

  mockUseAuthState.mockReturnValue({
    checking: false,
    isUnlocked: false
  });
  mockUseAppData.mockReturnValue({
    envs: [],
    tasks: [],
    error: '',
    refreshAll: vi.fn(),
    setError: vi.fn(),
    setLoading: vi.fn(),
    accountState: { activeAccountId: null, accounts: [] },
    setAccountState: vi.fn(),
    setEnvs: vi.fn(),
    setTasks: vi.fn(),
    setupState: { ready: true }
  });
  mockUseActiveTab.mockReturnValue({
    activeTab: 1,
    setActiveTab: vi.fn()
  });
  mockUseTasksState.mockReturnValue({
    selection: {
      selectedTaskId: 'task-1',
      setSelectedTaskId
    },
    detail: {
      refreshTaskDetail: vi.fn(),
      setTaskDetail
    }
  });
  mockUseEnvironmentState.mockReturnValue({});
  mockUseAccountsState.mockReturnValue({
    activeAccount: null,
    refreshRateLimits: vi.fn().mockResolvedValue()
  });
  mockUseStateStream.mockImplementation(() => {});

  render(<AppStateProbe />);

  await waitFor(() => expect(setTaskDetail).toHaveBeenCalledWith(null));
  expect(setSelectedTaskId).not.toHaveBeenCalled();
});
