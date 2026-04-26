import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from './test-utils.jsx';
import TaskDetailPanel from '../src/app/tabs/tasks/TaskDetailPanel.jsx';

vi.mock('../src/app/tabs/tasks/detail/TaskDetailActions.jsx', () => ({
  __esModule: true,
  default: () => null
}));

vi.mock('../src/app/tabs/tasks/detail/TaskDetailHeader.jsx', () => ({
  __esModule: true,
  default: () => <div>task header</div>
}));

vi.mock('../src/app/tabs/tasks/detail/TaskDetailSummaryCard.jsx', () => ({
  __esModule: true,
  default: () => <div>task summary</div>
}));

vi.mock('../src/app/tabs/tasks/detail/TaskDiff.jsx', () => ({
  __esModule: true,
  default: () => <div>task diff</div>
}));

vi.mock('../src/app/tabs/tasks/detail/TaskArtifacts.jsx', () => ({
  __esModule: true,
  default: () => <div>task artifacts</div>
}));

vi.mock('../src/app/tabs/tasks/detail/TaskRunOverrides.jsx', () => ({
  __esModule: true,
  default: () => <div>run overrides</div>
}));

vi.mock('../src/app/tabs/tasks/detail/TaskRuns.jsx', () => ({
  __esModule: true,
  default: () => <div>run logs</div>
}));

function createTaskDetail({ entryCount = 1, status = 'completed', taskId = 'task-1' } = {}) {
  return {
    taskId,
    repoUrl: 'https://github.com/openai/codex.git',
    branchName: `branch-${taskId}`,
    status,
    gitStatus: {
      hasChanges: false,
      pushed: true,
      dirty: false
    },
    runLogs: [
      {
        runId: `${taskId}-run-1`,
        status,
        entries: Array.from({ length: entryCount }, (_, index) => ({
          id: `${taskId}-entry-${index + 1}`,
          timestamp: `2024-01-0${index + 1}T00:00:00Z`
        }))
      }
    ]
  };
}

function createTasksState({
  selectedTaskId = 'task-1',
  taskDetail = createTaskDetail({ taskId: selectedTaskId })
} = {}) {
  return {
    actions: {
      handlePushTask: vi.fn(),
      handleStopTask: vi.fn()
    },
    detail: {
      taskDetail
    },
    handleResumeModelChoiceChange: vi.fn(),
    now: Date.now(),
    selection: {
      handleBackToTasks: vi.fn(),
      selectedTaskId
    }
  };
}

function mockPaneScrollMetrics(node, metrics) {
  Object.defineProperty(node, 'clientHeight', {
    configurable: true,
    get: () => metrics.clientHeight
  });
  Object.defineProperty(node, 'scrollHeight', {
    configurable: true,
    get: () => metrics.scrollHeight
  });
  Object.defineProperty(node, 'scrollTop', {
    configurable: true,
    get: () => metrics.scrollTop,
    set: (value) => {
      metrics.scrollTop = value;
    }
  });
}

describe('TaskDetailPanel', () => {
  it('honors an intentional detail tab deep link on first load', () => {
    window.history.pushState({}, '', '/?tab=tasks&taskId=task-1&detailTab=diff');

    render(
      <TaskDetailPanel
        data={{ envs: [], loading: false }}
        tasksState={createTasksState()}
      />
    );

    expect(screen.getByText('task diff')).toBeInTheDocument();
    expect(screen.getByText('task header')).toBeInTheDocument();
    expect(screen.getByText('task summary')).toBeInTheDocument();
    expect(screen.queryByText('run overrides')).not.toBeInTheDocument();
    expect(screen.queryByText('run logs')).not.toBeInTheDocument();
  });

  it('honors an artifacts detail tab deep link on first load', () => {
    window.history.pushState({}, '', '/?tab=tasks&taskId=task-1&detailTab=artifacts');

    render(
      <TaskDetailPanel
        data={{ envs: [], loading: false }}
        tasksState={createTasksState()}
      />
    );

    expect(screen.getByText('task artifacts')).toBeInTheDocument();
    expect(screen.getByText('task header')).toBeInTheDocument();
    expect(screen.getByText('task summary')).toBeInTheDocument();
    expect(screen.queryByText('task diff')).not.toBeInTheDocument();
    expect(screen.queryByText('run logs')).not.toBeInTheDocument();
  });

  it('starts running tasks at the live tail and stops auto-follow after manual scroll away', async () => {
    const initialState = createTasksState({
      selectedTaskId: 'task-1',
      taskDetail: createTaskDetail({ status: 'running', taskId: 'task-1' })
    });
    const { container, rerender } = render(
      <TaskDetailPanel data={{ envs: [], loading: false }} tasksState={initialState} />
    );

    const overviewPane = container.querySelector('.task-detail-pane--overview');
    const metrics = {
      clientHeight: 320,
      scrollHeight: 1200,
      scrollTop: 0
    };
    mockPaneScrollMetrics(overviewPane, metrics);

    rerender(
      <TaskDetailPanel
        data={{ envs: [], loading: false }}
        tasksState={createTasksState({
          selectedTaskId: 'task-2',
          taskDetail: createTaskDetail({ status: 'running', taskId: 'task-2' })
        })}
      />
    );

    await waitFor(() => expect(metrics.scrollTop).toBe(metrics.scrollHeight));

    metrics.scrollHeight = 1600;
    rerender(
      <TaskDetailPanel
        data={{ envs: [], loading: false }}
        tasksState={createTasksState({
          selectedTaskId: 'task-2',
          taskDetail: createTaskDetail({
            entryCount: 2,
            status: 'running',
            taskId: 'task-2'
          })
        })}
      />
    );

    await waitFor(() => expect(metrics.scrollTop).toBe(1600));

    metrics.scrollTop = 900;
    fireEvent.scroll(overviewPane);

    metrics.scrollHeight = 2000;
    rerender(
      <TaskDetailPanel
        data={{ envs: [], loading: false }}
        tasksState={createTasksState({
          selectedTaskId: 'task-2',
          taskDetail: createTaskDetail({
            entryCount: 3,
            status: 'running',
            taskId: 'task-2'
          })
        })}
      />
    );

    await waitFor(() => expect(metrics.scrollTop).toBe(900));
  });

  it('supports keyboard navigation between detail tabs', async () => {
    render(
      <TaskDetailPanel
        data={{ envs: [], loading: false }}
        tasksState={createTasksState()}
      />
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), { key: 'ArrowRight' });

    await waitFor(() => expect(screen.getByText('task diff')).toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Diff' }), { key: 'ArrowRight' });

    await waitFor(() => expect(screen.getByText('task artifacts')).toBeInTheDocument());
  });
});
