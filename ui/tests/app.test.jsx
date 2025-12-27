import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';

it('renders the orchestrator header and forms', async () => {
  render(<App />);
  expect(await screen.findByText('Codex Docker Orchestrator')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Environments' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
});
