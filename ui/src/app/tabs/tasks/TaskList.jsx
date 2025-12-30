import {
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import StatusIcon from '../../components/StatusIcon.jsx';
import { STATUS_CONFIG } from '../../constants.js';
import { formatDuration, formatTimestamp } from '../../formatters.js';
import { formatEffortDisplay, formatModelDisplay } from '../../model-helpers.js';
import { formatRepoDisplay } from '../../repo-helpers.js';
import { getElapsedMs, getLatestRun } from '../../task-helpers.js';

function TaskList({ data, tasksState }) {
  const { loading } = data;
  const { actions, now, selection, visibleTasks } = tasksState;

  return (
    <Stack spacing={2}>
      <Typography variant="h6" className="panel-title">
        Tasks
      </Typography>
      <Stack spacing={1.5}>
        {visibleTasks.map((task) => (
          <Card
            key={task.taskId}
            className="task-card"
            sx={{
              borderColor: task.taskId === selection.selectedTaskId ? 'primary.main' : 'divider',
              cursor: 'pointer'
            }}
            onClick={() => selection.setSelectedTaskId(task.taskId)}
          >
            <CardContent>
              <Stack spacing={1}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography fontWeight={600}>{task.branchName}</Typography>
                  <StatusIcon status={task.status} />
                </Stack>
                <Tooltip title={task.repoUrl || ''}>
                  <Typography color="text.secondary">
                    {formatRepoDisplay(task.repoUrl) || task.repoUrl}
                  </Typography>
                </Tooltip>
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                  <Chip size="small" label={task.ref} />
                  {(task.model || task.reasoningEffort) && (
                    <Chip
                      size="small"
                      label={`model: ${formatModelDisplay(task.model)}`}
                    />
                  )}
                  {(task.model || task.reasoningEffort) && (
                    <Chip
                      size="small"
                      label={`effort: ${formatEffortDisplay(task.reasoningEffort)}`}
                    />
                  )}
                  <Chip size="small" label={`created ${formatTimestamp(task.createdAt)}`} />
                  {(task.status === 'running' || task.status === 'stopping') &&
                    (() => {
                      const latestRun = getLatestRun(task);
                      const durationMs = getElapsedMs(
                        latestRun?.startedAt || task.createdAt,
                        null,
                        now
                      );
                      if (durationMs === null) {
                        return null;
                      }
                      const statusLabel =
                        STATUS_CONFIG[task.status]?.label.toLowerCase() || 'running';
                      return (
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<AccessTimeIcon fontSize="small" />}
                          label={`${statusLabel} ${formatDuration(durationMs)}`}
                        />
                      );
                    })()}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Tooltip title="Stop task">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(event) => {
                          event.stopPropagation();
                          actions.handleStopTask(task.taskId);
                        }}
                        disabled={loading || task.status !== 'running'}
                        aria-label={`Stop task ${task.taskId}`}
                      >
                        <StopCircleOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove task">
                    <span>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          actions.handleDeleteTask(task.taskId);
                        }}
                        disabled={loading}
                        aria-label={`Remove task ${task.taskId}`}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {visibleTasks.length === 0 && (
          <Typography color="text.secondary">No tasks yet. Create one to get started.</Typography>
        )}
      </Stack>
    </Stack>
  );
}

export default TaskList;
