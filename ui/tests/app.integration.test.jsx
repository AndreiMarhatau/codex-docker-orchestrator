/* eslint-disable max-lines, max-lines-per-function */
import { fireEvent, render, screen, waitFor, within } from './test-utils.jsx';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { accounts, envs, rateLimits, taskDetail, taskDiff, tasks, zeroRunTaskDetail } from './app-fixtures.js';
import { exerciseAccountsTab, exerciseEnvironmentsTab } from './app-integration-helpers.js';
import mockApi from './helpers/mock-api.js';

async function configureNewTask(user) {
  expect(await screen.findByLabelText('Environment filter')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'New task' }));
  const createDialog = await screen.findByRole('dialog');
  expect(within(createDialog).getByText('Create New Task')).toBeInTheDocument();

  const primaryEnvSelect = within(createDialog).getAllByLabelText('Environment')[0];
  await user.click(primaryEnvSelect);
  await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
  await user.type(within(createDialog).getByLabelText('Prompt'), 'Refactor UI');

  const modelSelect = within(createDialog).getByLabelText('Model (optional)');
  await user.click(modelSelect);
  await user.click(await screen.findByRole('option', { name: 'gpt-5.2' }));

  const reasoningSelect = within(createDialog).getByLabelText('Effort (optional)');
  await user.click(reasoningSelect);
  await user.click(await screen.findByRole('option', { name: 'high' }));

  await user.click(modelSelect);
  await user.click(await screen.findByRole('option', { name: 'Custom model...' }));
  await user.type(within(createDialog).getByLabelText('Custom model'), 'gpt-custom');
  const customEffortInput = within(createDialog).getByLabelText('Effort (optional)');
  await user.clear(customEffortInput);
  await user.type(customEffortInput, 'xhigh');

  await user.click(within(createDialog).getByLabelText('Enable Docker'));

  const envSelect = within(createDialog).getAllByLabelText('Environment')[0];
  await user.click(envSelect);
  await user.click(await screen.findByRole('option', { name: 'openai/codex' }));
  expect(within(createDialog).getByLabelText('Branch / tag / ref').getAttribute('placeholder')).toContain('main');

  await user.click(within(createDialog).getByRole('button', { name: 'Add repository' }));
  expect(within(createDialog).getAllByLabelText('Environment').length).toBeGreaterThanOrEqual(2);

  const secondEnvSelect = within(createDialog).getAllByLabelText('Environment')[1];
  await user.click(secondEnvSelect);
  await user.click(await screen.findByRole('option', { name: 'openai/reference' }));
  await user.click(within(createDialog).getByLabelText('Remove reference repo'));

  const fileInput = createDialog.querySelector('input[type="file"]');
  const textFile = new File(['brief'], 'brief.txt', { type: 'text/plain' });
  await user.upload(fileInput, [textFile]);

  expect(screen.getByText(/brief.txt/)).toBeInTheDocument();

  const createButton = within(createDialog).getByRole('button', { name: 'Create Task' });
  await waitFor(() => expect(createButton).toBeEnabled());
  await user.click(createButton);
  await waitFor(() => expect(screen.queryByText('Create New Task')).not.toBeInTheDocument());
}

async function exerciseTaskDetail(user) {
  await user.click(screen.getByText('feature/refactor'));
  expect(screen.getByText('Hello from agent')).toBeInTheDocument();
  expect(screen.getByText('Second agent update')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Artifacts 2/ }));
  expect(screen.queryAllByText('output.png').length).toBeGreaterThan(0);
  expect(screen.queryAllByText('report.txt').length).toBeGreaterThan(0);

  await user.click(screen.getByRole('tab', { name: 'Diff' }));
  await user.click(await screen.findByRole('button', { name: 'Show diff' }));
  expect(screen.getByText('diff content')).toBeInTheDocument();

  await user.click(screen.getByRole('tab', { name: 'Overview' }));
  await user.click(screen.getByRole('button', { name: 'Ask for changes' }));
  const resumeDialog = screen.getByRole('dialog');
  expect(within(resumeDialog).getByText('Ask for Changes')).toBeInTheDocument();

  const resumeModelSelect = within(resumeDialog).getByLabelText('Model (optional)');
  await user.click(resumeModelSelect);
  await user.click(await screen.findByRole('option', { name: 'gpt-5.2' }));
  const resumeEffortSelect = within(resumeDialog).getByLabelText('Effort (optional)');
  await user.click(resumeEffortSelect);
  await user.click(await screen.findByRole('option', { name: 'high' }));

  await user.click(resumeModelSelect);
  await user.click(await screen.findByRole('option', { name: 'Custom model...' }));
  await user.type(within(resumeDialog).getByLabelText('Custom model'), 'resume-model');
  const customResumeEffortInput = within(resumeDialog).getByLabelText('Effort (optional)');
  await user.clear(customResumeEffortInput);
  await user.type(customResumeEffortInput, 'low');

  const resumePromptInput = within(resumeDialog).getByRole('textbox', {
    name: 'Continuation prompt'
  });
  fireEvent.change(resumePromptInput, {
    target: { value: 'Continue with more detail.' }
  });
  expect(resumePromptInput).toHaveValue('Continue with more detail.');
  const resumeRefInput = within(resumeDialog).getByLabelText('Branch / tag / ref');
  await user.clear(resumeRefInput);
  await user.type(resumeRefInput, 'release');
  const resumeFileInput = resumeDialog.querySelector('input[type="file"]');
  const resumeFile = new File(['notes'], 'notes.txt', { type: 'text/plain' });
  await user.upload(resumeFileInput, [resumeFile]);
  await user.click(within(resumeDialog).getByLabelText('Enable Docker'));
  const existingAttachment = within(resumeDialog).getByText('requirements.txt').closest('.task-compose-file-item');
  await user.click(within(existingAttachment).getByRole('button', { name: 'Remove' }));
  const continueButton = within(resumeDialog).getByRole('button', { name: 'Continue Task' });
  await waitFor(() => expect(continueButton).toBeEnabled());
  await user.click(continueButton);
  await waitFor(() => expect(screen.queryByText('Ask for Changes')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Push' }));
  await user.click(screen.getByLabelText('Back to tasks'));
  await user.click(screen.getByText('feature/preflight'));
  await user.click(screen.getByRole('button', { name: /Task context/ }));
  await user.click(screen.getByRole('button', { name: /Task files 1/ }));
  expect(screen.getByText('brief.md')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Reference repos 1/ }));
  expect(screen.getByText('openai/reference')).toBeInTheDocument();
  await user.click(screen.getByLabelText('Back to tasks'));
  const removeTaskButtons = screen.getAllByLabelText(/Remove task/);
  await user.click(removeTaskButtons[removeTaskButtons.length - 1]);
}

it(
  'renders the orchestrator sections and task details',
  async () => {
    let envsState = envs.map((env) => ({ ...env }));
    let nextUploadId = 1;
    let resumeRequestBody = null;
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
      'POST /api/uploads/files': ({ options }) => {
        const uploads = [];
        for (const [, value] of options.body.entries()) {
          uploads.push({
            path: `/tmp/upload-${nextUploadId}`,
            originalName: value.name,
            size: value.size,
            mimeType: value.type
          });
          nextUploadId += 1;
        }
        return { uploads };
      },
      'POST /api/tasks': {},
      'POST /api/tasks/task-1/resume': ({ body }) => {
        resumeRequestBody = body;
        return {};
      },
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
      [`/api/tasks/${taskDetail.taskId}/diff`]: taskDiff,
      [`/api/tasks/${zeroRunTaskDetail.taskId}`]: zeroRunTaskDetail,
      [`/api/tasks/${zeroRunTaskDetail.taskId}/diff`]: {
        available: false,
        baseSha: '',
        files: []
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() =>
      expect(screen.queryByText('Orchestrator locked')).not.toBeInTheDocument()
    );

    expect(await screen.findByLabelText('Environment filter')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Environments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument();

    await configureNewTask(user);
    await exerciseTaskDetail(user);
    expect(resumeRequestBody.attachmentRemovals).toEqual(['requirements.txt']);
    expect(resumeRequestBody.fileUploads).toHaveLength(1);
    expect(resumeRequestBody.fileUploads[0].originalName).toBe('notes.txt');
    await exerciseEnvironmentsTab(user);
    await exerciseAccountsTab(user);

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
  },
  90000
);
