import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useActiveTab from '../src/app/hooks/useActiveTab.js';

function TabProbe() {
  const { activeTab } = useActiveTab();
  return <div data-testid="active-tab">{activeTab}</div>;
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
});
