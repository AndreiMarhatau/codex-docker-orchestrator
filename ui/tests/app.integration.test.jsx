import { render, screen, waitFor, within } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits, taskDetail, taskDiff, tasks } from './app-fixtures.js';
import { exerciseAccountsTab, exerciseEnvironmentsTab } from './app-integration-helpers.js';
import mockApi from './helpers/mock-api.js';

async function configureNewTask(user) {
  expect(await screen.findByText('2 total')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'New task' }));
  const createDialog = await screen.findByRole('dialog', { name: 'New task' });

  await user.click(within(createDialog).getByRole('button', { name: 'openai/codex' }));
  await user.click(await screen.findByRole('menuitem', { name: 'openai/codex' }));
  await user.type(within(createDialog).getByLabelText('Task prompt'), 'Refactor UI');

  await user.click(within(createDialog).getByLabelText('Advanced task settings'));
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

  const envSelect = await screen.findByLabelText('Environment');
  await user.click(envSelect);
  await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
  expect(screen.getByLabelText('Branch / tag / ref')).toHaveValue('main');
  expect(screen.getAllByLabelText('Environment')).toHaveLength(2);

  const secondEnvSelect = screen.getAllByLabelText('Environment')[1];
  await user.click(secondEnvSelect);
  await user.click(await screen.findByRole('option', { name: 'openai/reference' }));
  expect(screen.getAllByLabelText('Environment')).toHaveLength(2);
  await user.click(screen.getAllByLabelText('Remove reference repo')[1]);

  const fileInput = createDialog.querySelector('input[type="file"]');
  const textFile = new File(['brief'], 'brief.txt', { type: 'text/plain' });
  await user.upload(fileInput, [textFile]);

  expect(screen.getByText(/brief.txt/)).toBeInTheDocument();

  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Run task' }));
  expect(
    await screen.findByRole('button', { name: 'Uploading attachments... 50%' })
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'New task' })).not.toBeInTheDocument()
  );
}

async function exerciseTaskDetail(user) {
  await user.click(screen.getByLabelText('Stop task task-2'));
  await user.click(screen.getByLabelText('Remove task task-2'));

  await user.click(screen.getByText('feature/refactor'));
  expect(screen.getByText('Agent messages')).toBeInTheDocument();
  expect(screen.getByText('Hello from agent')).toBeInTheDocument();
  expect(screen.getByText('Second agent update')).toBeInTheDocument();
  expect(document.querySelectorAll('.agent-message-item')).toHaveLength(2);
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
  await user.click(within(resumeDialog).getByLabelText('Additional settings'));
  const resumeRefInputs = screen.getAllByLabelText('Branch / tag / ref');
  await user.clear(resumeRefInputs[0]);
  await user.type(resumeRefInputs[0], 'release');
  const resumeFileInput = resumeDialog.querySelector('input[type="file"]');
  const resumeFile = new File(['notes'], 'notes.txt', { type: 'text/plain' });
  await user.upload(resumeFileInput, [resumeFile]);
  await user.click(screen.getByLabelText('Use host Docker socket'));
  await user.click(screen.getByLabelText('Close settings'));
  await user.click(within(resumeDialog).getByRole('button', { name: /requirements\.txt/i }));
  await user.click(screen.getByRole('button', { name: 'Continue task' }));
  expect(
    await screen.findByRole('button', { name: 'Uploading attachments... 50%' })
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Ask for changes' })).not.toBeInTheDocument()
  );
  await user.click(screen.getByRole('button', { name: 'Push' }));
  await user.click(screen.getByLabelText('Back to tasks'));
  const removeTaskButtons = screen.getAllByLabelText(/Remove task/);
  await user.click(removeTaskButtons[removeTaskButtons.length - 1]);
}

it(
  'renders the orchestrator sections and task details',
  async () => {
    let envsState = envs.map((env) => ({ ...env }));
    let accountState = {
      activeAccountId: accounts.activeAccountId,
      accounts: accounts.accounts.map((account) => ({ ...account }))
    };
    const activateAccount = (accountId) => {
      accountState = {
        activeAccountId: accountId,
        accounts: accountState.accounts.map((account, index) => ({
          ...account,
          isActive: account.id === accountId,
          position: account.id === accountId ? 1 : index + 1
        }))
      };
      return accountState;
    };
    const removeAccount = (accountId) => {
      const remaining = accountState.accounts.filter((account) => account.id !== accountId);
      accountState = {
        activeAccountId: remaining[0]?.id || null,
        accounts: remaining.map((account, index) => ({
          ...account,
          isActive: index === 0,
          position: index + 1
        }))
      };
      return accountState;
    };
    const renameAccount = (accountId, label) => {
      accountState = {
        ...accountState,
        accounts: accountState.accounts.map((account) => ({
          ...account,
          label: account.id === accountId ? label : account.label
        }))
      };
      return accountState;
    };
    mockApi({
      '/api/settings/setup': {
        ready: true,
        gitTokenConfigured: true,
        accountConfigured: true,
        gitUserName: 'Codex Agent',
        gitUserEmail: 'codex@openai.com'
      },
      '/api/envs': () => envsState,
      '/api/tasks': tasks,
      '/api/accounts': () => accountState,
      'POST /api/uploads/files': {
        delay: 300,
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
      'POST /api/tasks/task-1/attachments': { delay: 300, attachments: [] },
      'DELETE /api/tasks/task-1/attachments': { attachments: [] },
      'POST /api/tasks/task-1/resume': {},
      'POST /api/tasks/task-1/push': {},
      'POST /api/tasks/task-2/stop': {},
      'DELETE /api/tasks/task-2': {},
      'DELETE /api/tasks/task-1': {},
      'DELETE /api/envs/env-1': () => {
        envsState = envsState.filter((env) => env.envId !== 'env-1');
        return {};
      },
      'DELETE /api/envs/env-2': () => {
        envsState = envsState.filter((env) => env.envId !== 'env-2');
        return {};
      },
      'PATCH /api/envs/env-1': ({ body }) => {
        envsState = envsState.map((env) =>
          env.envId === 'env-1'
            ? { ...env, defaultBranch: body.defaultBranch, envVars: body.envVars }
            : env
        );
        return envsState.find((env) => env.envId === 'env-1');
      },
      'POST /api/accounts': ({ body }) => {
        accountState = {
          ...accountState,
          accounts: [
            ...accountState.accounts,
            {
              id: `acct-${accountState.accounts.length + 1}`,
              label: body.label,
              authJson: body.authJson,
              position: accountState.accounts.length + 1,
              isActive: false,
              createdAt: '2024-01-01T12:00:00Z'
            }
          ]
        };
        return accountState;
      },
      'POST /api/accounts/rotate': () => {
        const [current, ...rest] = accountState.accounts;
        const rotated = [...rest, current].map((account, index) => ({
          ...account,
          isActive: index === 0,
          position: index + 1
        }));
        accountState = {
          activeAccountId: rotated[0]?.id || null,
          accounts: rotated
        };
        return accountState;
      },
      'POST /api/accounts/acct-1/activate': () => activateAccount('acct-1'),
      'POST /api/accounts/acct-2/activate': () => activateAccount('acct-2'),
      'POST /api/accounts/acct-3/activate': () => activateAccount('acct-3'),
      'DELETE /api/accounts/acct-1': () => removeAccount('acct-1'),
      'DELETE /api/accounts/acct-2': () => removeAccount('acct-2'),
      'DELETE /api/accounts/acct-3': () => removeAccount('acct-3'),
      'PATCH /api/accounts/acct-1/auth-json': () => {
        accountState = {
          ...accountState,
          accounts: accountState.accounts.map((account) => ({
            ...account,
            authJson:
              account.id === 'acct-1'
                ? '{\n  "token": "primary-updated"\n}'
                : account.authJson
          }))
        };
        return accountState;
      },
      'PATCH /api/accounts/acct-1': () => renameAccount('acct-1', 'Ops Renamed'),
      'PATCH /api/accounts/acct-2': () => renameAccount('acct-2', 'Ops Renamed'),
      'PATCH /api/accounts/acct-3': () => renameAccount('acct-3', 'Ops Renamed'),
      'POST /api/accounts/trigger-usage': {
        triggeredAt: '2024-01-01T00:01:00Z'
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
  90000
);
