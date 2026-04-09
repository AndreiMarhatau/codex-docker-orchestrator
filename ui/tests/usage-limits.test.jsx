import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { render, screen } from './test-utils.jsx';
import UsageLimits from '../src/app/tabs/accounts/UsageLimits.jsx';

function createAccountsState(overrides = {}) {
  return {
    activeAccount: { id: 'acct-1', label: 'Ops' },
    rateLimits: null,
    rateLimitsError: '',
    rateLimitsFetchedAt: '',
    rateLimitsLoading: false,
    refreshRateLimits: () => {},
    triggerUsage: () => {},
    triggerUsageError: '',
    triggerUsageLoading: false,
    triggerUsageTriggeredAt: '',
    ...overrides
  };
}

it('renders dynamic rate-limit windows and unlimited credits', async () => {
  const user = userEvent.setup();
  const refreshRateLimits = vi.fn();
  const triggerUsage = vi.fn();

  render(
    <UsageLimits
      accountsState={createAccountsState({
        rateLimits: {
          windows: {
            long_session: {
              usedPercent: 25,
              windowDurationMins: 120,
              resetsAt: 1730947200
            },
            '': null
          },
          credits: { hasCredits: true, unlimited: true },
          planType: 'enterprise'
        },
        rateLimitsFetchedAt: '2025-12-19T00:00:00.000Z',
        refreshRateLimits,
        triggerUsage,
        triggerUsageTriggeredAt: '2025-12-19T00:01:00.000Z'
      })}
    />
  );

  expect(screen.getByText('Long Session')).toBeInTheDocument();
  expect(screen.getByText('Unknown')).toBeInTheDocument();
  expect(screen.getByText('Unlimited credits.')).toBeInTheDocument();
  expect(screen.getByText('Plan: enterprise')).toBeInTheDocument();
  expect(screen.getByText(/Last checked/)).toBeInTheDocument();
  expect(screen.getByText(/Last usage trigger/)).toBeInTheDocument();
  expect(screen.getByText('No data.')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Check usage limits' }));
  await user.click(screen.getByRole('button', { name: 'Trigger usage' }));

  expect(refreshRateLimits).toHaveBeenCalledTimes(1);
  expect(triggerUsage).toHaveBeenCalledTimes(1);
});

it('renders fallback states when no rate limits are loaded and credits are finite without a balance', () => {
  const { rerender } = render(<UsageLimits accountsState={createAccountsState()} />);

  expect(screen.getByText('Usage limits have not been loaded yet.')).toBeInTheDocument();

  rerender(
    <UsageLimits
      accountsState={createAccountsState({
        activeAccount: null,
        rateLimits: {
          windows: {},
          credits: { hasCredits: true },
          planType: null
        }
      })}
    />
  );

  expect(screen.getByText('No active account selected.')).toBeInTheDocument();
  expect(screen.getByText('No rate-limit windows available.')).toBeInTheDocument();
  expect(screen.getByText('Credits available.')).toBeInTheDocument();
});
