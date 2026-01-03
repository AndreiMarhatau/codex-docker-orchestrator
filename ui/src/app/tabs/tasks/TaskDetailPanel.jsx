import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import TaskDetailActions from './detail/TaskDetailActions.jsx';
import TaskDetailHeader from './detail/TaskDetailHeader.jsx';
import TaskDiff from './detail/TaskDiff.jsx';
import TaskRunOverrides from './detail/TaskRunOverrides.jsx';
import TaskRuns from './detail/TaskRuns.jsx';

function TaskDetailPanel({ data, tasksState }) {
  const { refreshAll } = data;
  const { detail, selection } = tasksState;
  const hasTaskDetail = Boolean(detail.taskDetail);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    setActiveTab(0);
  }, [selection.selectedTaskId]);

  const isRunning = useMemo(() => {
    const status = detail.taskDetail?.status;
    return status === 'running' || status === 'stopping';
  }, [detail.taskDetail?.status]);

  const showPush = useMemo(() => {
    const gitStatus = detail.taskDetail?.gitStatus;
    if (!gitStatus) {
      return false;
    }
    return gitStatus.hasChanges === true && gitStatus.pushed === false;
  }, [detail.taskDetail?.gitStatus]);

  const taskTitle = detail.taskDetail?.branchName || 'Task details';

  return (
    <Box className="task-detail-shell">
      <Box className="task-detail-top">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title="Back to tasks">
            <IconButton
              size="small"
              color="primary"
              onClick={selection.handleBackToTasks}
              aria-label="Back to tasks"
            >
              <ArrowBackOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Stack spacing={0.4}>
            <Typography variant="h6" className="panel-title">
              {taskTitle}
            </Typography>
          </Stack>
        </Stack>
        <Button size="small" variant="outlined" onClick={refreshAll}>
          Refresh
        </Button>
      </Box>
      <Tabs
        className="task-detail-tabs"
        value={activeTab}
        onChange={(event, value) => setActiveTab(value)}
        aria-label="Task detail tabs"
        variant="scrollable"
        allowScrollButtonsMobile
      >
        <Tab label="Overview" />
        <Tab label="Diff" />
      </Tabs>
      <Box className="task-detail-content">
        {!hasTaskDetail && (
          <Box className="task-detail-pane">
            <Typography color="text.secondary">Loading task details...</Typography>
          </Box>
        )}
        {hasTaskDetail && activeTab === 0 && (
          <Box className="task-detail-pane">
            <Stack spacing={2}>
              <TaskDetailHeader tasksState={tasksState} />
              <TaskRunOverrides tasksState={tasksState} />
              <TaskRuns tasksState={tasksState} />
            </Stack>
          </Box>
        )}
        {hasTaskDetail && activeTab === 1 && (
          <Box className="task-detail-pane">
            <TaskDiff tasksState={tasksState} />
          </Box>
        )}
      </Box>
      <TaskDetailActions
        data={data}
        hasTaskDetail={hasTaskDetail}
        isRunning={isRunning}
        showPush={showPush}
        tasksState={tasksState}
      />
    </Box>
  );
}

export default TaskDetailPanel;
