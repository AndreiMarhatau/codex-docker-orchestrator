import { render, screen } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import useActiveTab from '../src/app/hooks/useActiveTab.js';

function TabProbe() {
  const { activeTab, setActiveTab } = useActiveTab();
  return (
    <>
      <div data-testid="active-tab">{activeTab}</div>
      <button type="button" onClick={() => setActiveTab(2)}>
        Switch to accounts
      </button>
    </>
  );
}

describe('useActiveTab', () => {
  it('defaults to tasks when no tab is set', () => {
    window.history.pushState({}, '', '/');
    render(<TabProbe />);
    expect(screen.getByTestId('active-tab')).toHaveTextContent('1');
  });

  it('respects query string tab', () => {
    window.history.pushState({}, '', '/?tab=settings');
    render(<TabProbe />);
    expect(screen.getByTestId('active-tab')).toHaveTextContent('3');
  });

  it('respects hash tab', () => {
    window.history.pushState({}, '', '/#accounts');
    render(<TabProbe />);
    expect(screen.getByTestId('active-tab')).toHaveTextContent('2');
  });

  it('handles environments tab', () => {
    window.history.pushState({}, '', '/?tab=environments');
    render(<TabProbe />);
    expect(screen.getByTestId('active-tab')).toHaveTextContent('0');
  });

  it('keeps the tab query param in sync', async () => {
    window.history.pushState({}, '', '/?tab=tasks');
    const user = userEvent.setup();
    render(<TabProbe />);

    await user.click(screen.getByRole('button', { name: 'Switch to accounts' }));
    expect(window.location.search).toContain('tab=accounts');
  });
});
