import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits, taskDetail, taskDiff, tasks } from './app-fixtures.js';
import mockApi from './helpers/mock-api.js';

it(
  'renders the orchestrator sections and task details',
  async () => {
    mockApi({
      '/api/envs': envs,
      '/api/tasks': tasks,
      '/api/accounts': accounts,
      'POST /api/tasks': {},
      'POST /api/tasks/task-1/resume': {},
      'POST /api/tasks/task-1/push': {},
      'POST /api/tasks/task-2/stop': {},
      'DELETE /api/tasks/task-2': {},
      'DELETE /api/tasks/task-1': {},
      'DELETE /api/envs/env-1': {},
      'POST /api/accounts': accounts,
      'POST /api/accounts/rotate': accounts,
      'POST /api/accounts/acct-2/activate': accounts,
      'DELETE /api/accounts/acct-2': accounts,
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      [`/api/tasks/${taskDetail.taskId}`]: taskDetail,
      [`/api/tasks/${taskDetail.taskId}/diff`]: taskDiff
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByLabelText('Filter')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Environments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New task' }));
    expect(await screen.findByText('New task')).toBeInTheDocument();

    const environmentSelect = screen.getByLabelText('Environment');
    await user.click(environmentSelect);
    await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
    await user.type(screen.getByLabelText('Task prompt'), 'Refactor UI');

    const modelSelect = screen.getByLabelText('Model');
    await user.click(modelSelect);
    await user.click(await screen.findByRole('option', { name: 'gpt-5.2' }));

    const reasoningSelect = screen.getByLabelText('Reasoning effort');
    await user.click(reasoningSelect);
    await user.click(await screen.findByRole('option', { name: 'high' }));

    await user.click(modelSelect);
    await user.click(await screen.findByRole('option', { name: 'Custom model...' }));
    await user.type(screen.getByLabelText('Custom model'), 'gpt-custom');
    await user.type(screen.getByLabelText('Custom reasoning effort'), 'xhigh');

    await user.click(screen.getByLabelText('Use host Docker socket'));

    await user.click(screen.getByRole('button', { name: 'Add reference repo' }));
    const envSelects = screen.getAllByLabelText('Environment');
    await user.click(envSelects[1]);
    await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
    const refInputs = screen.getAllByLabelText('Branch / tag / ref');
    await user.type(refInputs[1], 'dev');
    await user.click(screen.getByLabelText('Remove reference repo'));

    const fileInput = document.querySelector('input[type="file"]');
    const imageFile = new File(['image'], 'image.png', { type: 'image/png' });
    await user.upload(fileInput, [imageFile]);

    expect(await screen.findByText(/image.png/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear images' }));
    expect(screen.queryByText(/image.png/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Run task' }));

    await user.click(screen.getByLabelText('Stop task task-2'));
    await user.click(screen.getByLabelText('Remove task task-2'));

    await user.click(screen.getByText('feature/refactor'));
    expect(await screen.findByText('Task details')).toBeInTheDocument();
    expect(screen.getByText('Agent messages')).toBeInTheDocument();
    expect(screen.getByText('output.png')).toBeInTheDocument();
    expect(screen.getByText('report.txt')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show diff' }));
    expect(screen.getByText('diff content')).toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
    window.dispatchEvent(new Event('scroll'));
    await user.click(await screen.findByLabelText('Scroll to top'));

    const modelOverrideSelect = screen.getByLabelText('Model override');
    await user.click(modelOverrideSelect);
    await user.click(await screen.findByRole('option', { name: 'gpt-5.2' }));
    const resumeEffortSelect = screen.getByLabelText('Reasoning effort');
    await user.click(resumeEffortSelect);
    await user.click(await screen.findByRole('option', { name: 'high' }));

    await user.click(modelOverrideSelect);
    await user.click(await screen.findByRole('option', { name: 'Custom model...' }));
    await user.type(screen.getByLabelText('Custom model'), 'resume-model');
    await user.type(screen.getByLabelText('Custom reasoning effort'), 'low');

    await user.type(screen.getByLabelText('Resume prompt'), 'Continue with more detail.');
    await user.click(screen.getByLabelText('Use host Docker socket for this run'));
    await user.click(screen.getByRole('button', { name: 'Continue task' }));
    await user.click(screen.getByRole('button', { name: 'Push' }));
    const removeTaskButtons = screen.getAllByLabelText('Remove task');
    await user.click(removeTaskButtons[removeTaskButtons.length - 1]);

    await user.click(screen.getByRole('tab', { name: 'Environments' }));
    expect(
      await screen.findByText('Create and manage repo sources for Codex runs.')
    ).toBeInTheDocument();
    expect(screen.getByText('1 environments')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await user.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(await screen.findByText('Usage limits')).toBeInTheDocument();
    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
    expect(screen.getByText('Credits')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check usage limits' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rotate now' })).toBeEnabled()
    );
    await user.click(screen.getByRole('button', { name: 'Rotate now' }));
    await user.click(screen.getByRole('button', { name: 'New account' }));
    await user.type(screen.getByLabelText('Account label'), 'Ops');
    fireEvent.change(screen.getByLabelText('auth.json contents'), {
      target: { value: '{"token":"x"}' }
    });
    await user.click(screen.getByRole('button', { name: 'Add account' }));
    const activateButtons = screen.getAllByRole('button', { name: 'Make active' });
    await user.click(activateButtons[activateButtons.length - 1]);
    const removeAccountButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeAccountButtons[removeAccountButtons.length - 1]);

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
  },
  30000
);
