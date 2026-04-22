import userEvent from '@testing-library/user-event';
import { render, screen } from './test-utils.jsx';
import TaskRuns from '../src/app/tabs/tasks/detail/TaskRuns.jsx';
import RunAgentMessages from '../src/app/tabs/tasks/detail/runs/RunAgentMessages.jsx';
import RunEntries from '../src/app/tabs/tasks/detail/runs/RunEntries.jsx';
import RunRequest from '../src/app/tabs/tasks/detail/runs/RunRequest.jsx';

describe('run detail components', () => {
  it('renders the no-run empty state', () => {
    const tasksState = {
      now: '2024-01-02T12:05:00Z',
      detail: {
        taskDetail: {
          taskId: 'task-1',
          status: 'failed',
          runLogs: []
        }
      }
    };

    render(<TaskRuns tasksState={tasksState} />);

    expect(screen.getByText('No logs yet.')).toBeInTheDocument();
  });

  it('renders multi-run summaries', () => {
    const tasksState = {
      now: '2024-01-02T12:05:00Z',
      detail: {
        taskDetail: {
          taskId: 'task-1',
          status: 'completed',
          runLogs: [
            {
              runId: 'run-1',
              status: 'completed',
              startedAt: '2024-01-02T12:00:00Z',
              finishedAt: '2024-01-02T12:01:00Z',
              prompt: 'First request',
              entries: [],
              artifacts: []
            },
            {
              runId: 'run-2',
              status: 'completed',
              startedAt: '2024-01-02T12:02:00Z',
              finishedAt: '2024-01-02T12:03:00Z',
              prompt: 'Second request',
              entries: [],
              artifacts: []
            }
          ]
        }
      }
    };

    render(<TaskRuns tasksState={tasksState} />);

    expect(screen.getByText('Runs')).toBeInTheDocument();
    expect(screen.getByText('Run #1')).toBeInTheDocument();
    expect(screen.getByText('Run #2')).toBeInTheDocument();
    expect(screen.getByText('First request')).toBeInTheDocument();
    expect(screen.getByText('Second request')).toBeInTheDocument();
  });

  it('renders inline agent messages and expandable action groups', async () => {
    const user = userEvent.setup();
    render(
      <RunAgentMessages
        runId="run-1"
        timeline={[
          { type: 'message', text: 'Agent update' },
          {
            type: 'events',
            entries: [{ id: 'evt-1' }, { id: 'evt-2', type: 'command' }],
            summaries: [
              { label: 'Command', detail: 'npm test' },
              { label: 'File edit', detail: 'Updated task detail layout' }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText('Agent update')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 actions' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2 actions' }));
    expect(screen.getByText('npm test')).toBeInTheDocument();
    expect(screen.getByText('Updated task detail layout')).toBeInTheDocument();
    expect(screen.getByText('1. Command')).toBeInTheDocument();
    expect(screen.getByText('2. File edit')).toBeInTheDocument();
  });

  it('renders empty and populated raw event logs', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RunEntries entries={[]} emptyEntriesMessage="Nothing recorded yet." />
    );

    await user.click(screen.getByRole('button', { name: 'Raw event log 0' }));
    expect(screen.getByText('Nothing recorded yet.')).toBeInTheDocument();

    rerender(
      <RunEntries
        entries={[
          {
            type: 'response.output_item.done',
            parsed: {
              type: 'response.output_item.done',
              item: {
                type: 'tool_call',
                text: 'npm test'
              }
            }
          }
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Raw event log 1' }));
    expect(screen.getByText('response.output_item.done • tool_call')).toBeInTheDocument();
    expect(screen.getByText(/"type": "tool_call"/)).toBeInTheDocument();
  });

  it('falls back when a run prompt is missing', () => {
    render(<RunRequest run={{ prompt: '   ' }} />);

    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
