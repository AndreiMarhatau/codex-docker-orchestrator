import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits, taskDetail, taskDiff, tasks } from './app-fixtures.js';
import mockApi from './helpers/mock-api.js';

async function configureNewTask(user) {
  expect(await screen.findByText('2 total')).toBeInTheDocument();
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

  const fileInputs = document.querySelectorAll('input[type="file"]');
  const imageInput = fileInputs[0];
  const fileInput = fileInputs[1];
  const imageFile = new File(['image'], 'image.png', { type: 'image/png' });
  const textFile = new File(['brief'], 'brief.txt', { type: 'text/plain' });
  await user.upload(imageInput, [imageFile]);
  await user.upload(fileInput, [textFile]);

  expect(await screen.findByText(/image.png/)).toBeInTheDocument();
  expect(screen.getByText(/brief.txt/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Clear images' }));
  expect(screen.queryByText(/image.png/)).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Run task' }));
}

async function exerciseTaskDetail(user) {
  await user.click(screen.getByLabelText('Stop task task-2'));
  await user.click(screen.getByLabelText('Remove task task-2'));

  await user.click(screen.getByText('feature/refactor'));
  expect(screen.getByText('Agent messages')).toBeInTheDocument();
  expect(screen.getByText('output.png')).toBeInTheDocument();
  expect(screen.getByText('report.txt')).toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Diff' }));
  await user.click(await screen.findByRole('button', { name: 'Show diff' }));
  expect(screen.getByText('diff content')).toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Overview' }));

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

  await user.click(screen.getByRole('button', { name: 'Ask for changes' }));
  await user.type(
    screen.getByLabelText('Continuation prompt'),
    'Continue with more detail.'
  );
  const resumeDialog = screen.getByRole('dialog', { name: 'Ask for changes' });
  const resumeRefInputs = within(resumeDialog).getAllByLabelText('Branch / tag / ref');
  await user.clear(resumeRefInputs[0]);
  await user.type(resumeRefInputs[0], 'release');
  const resumeFileInput = resumeDialog.querySelector('input[type="file"]');
  const resumeFile = new File(['notes'], 'notes.txt', { type: 'text/plain' });
  await user.upload(resumeFileInput, [resumeFile]);
  await user.click(screen.getByLabelText(/requirements\.txt/i));
  await user.click(screen.getByLabelText('Use host Docker socket for this run'));
  await user.click(screen.getByRole('button', { name: 'Continue task' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Ask for changes' })).not.toBeInTheDocument()
  );
  await user.click(screen.getByRole('button', { name: 'Push' }));
  await user.click(screen.getByLabelText('Back to tasks'));
  const removeTaskButtons = screen.getAllByLabelText(/Remove task/);
  await user.click(removeTaskButtons[removeTaskButtons.length - 1]);
}

async function exerciseEnvironmentsTab(user) {
  await user.click(screen.getByRole('tab', { name: 'Environments' }));
  expect(await screen.findByText('Create and manage repo sources for Codex runs.')).toBeInTheDocument();
  expect(screen.getByText('2 environments')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Sync now' }));
  const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
  await user.click(removeButtons[removeButtons.length - 1]);
}

async function exerciseAccountsTab(user) {
  await user.click(screen.getByRole('tab', { name: 'Accounts' }));
  expect(await screen.findByText('Usage limits')).toBeInTheDocument();
  expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
  expect(screen.getByText('Credits')).toBeInTheDocument();
  const showAuthButtons = screen.getAllByRole('button', { name: 'Show auth.json' });
  await user.click(showAuthButtons[0]);
  expect(screen.getByText(/"token": "primary"/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Check usage limits' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Rotate now' })).toBeEnabled()
  );
  await user.click(screen.getByRole('button', { name: 'Rotate now' }));
  const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
  await user.click(renameButtons[renameButtons.length - 1]);
  await user.clear(screen.getByLabelText('New label'));
  await user.type(screen.getByLabelText('New label'), 'Ops Renamed');
  await user.click(screen.getByRole('button', { name: 'Save name' }));
  expect(await screen.findByText('Ops Renamed')).toBeInTheDocument();
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
}

it(
  'renders the orchestrator sections and task details',
  async () => {
    mockApi({
      '/api/envs': envs,
      '/api/tasks': tasks,
      '/api/accounts': accounts,
      'POST /api/uploads': { uploads: [{ path: '/tmp/uploaded.png' }] },
      'POST /api/uploads/files': {
        uploads: [
          {
            path: '/tmp/brief.txt',
            originalName: 'brief.txt',
            size: 128,
            mimeType: 'text/plain'
          }
        ]
      },
      'POST /api/tasks': {},
      'POST /api/tasks/task-1/attachments': { attachments: [] },
      'DELETE /api/tasks/task-1/attachments': { attachments: [] },
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
      'PATCH /api/accounts/acct-2': {
        ...accounts,
        accounts: accounts.accounts.map((account) => ({
          ...account,
          label: account.id === 'acct-2' ? 'Ops Renamed' : account.label
        }))
      },
      '/api/accounts/rate-limits': {
        rateLimits,
        fetchedAt: '2024-01-01T00:00:00Z'
      },
      [`/api/tasks/${taskDetail.taskId}`]: taskDetail,
      [`/api/tasks/${taskDetail.taskId}/diff`]: taskDiff
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    expect(await screen.findByLabelText('Filter')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Environments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();

    await configureNewTask(user);
    await exerciseTaskDetail(user);
    await exerciseEnvironmentsTab(user);
    await exerciseAccountsTab(user);

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
  },
  45000
);
