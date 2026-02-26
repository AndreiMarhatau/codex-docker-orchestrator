import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
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
  const { detail, selection } = tasksState;
  const hasTaskDetail = Boolean(detail.taskDetail);
  const [activeTab, setActiveTab] = useState(0);
  const overviewPaneRef = useRef(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    setActiveTab(0);
  }, [selection.selectedTaskId]);

  const runLogs = detail.taskDetail?.runLogs || [];
  const logUpdateToken = useMemo(() => {
    if (runLogs.length === 0) {
      return 'empty';
    }
    const lastRun = runLogs[runLogs.length - 1];
    const lastEntry = lastRun?.entries?.[lastRun.entries.length - 1];
    return `${runLogs.length}:${lastRun?.runId ?? 'none'}:${lastRun?.entries?.length ?? 0}:${lastEntry?.id ?? lastEntry?.timestamp ?? 'none'}`;
  }, [runLogs]);

  useEffect(() => {
    if (activeTab !== 0 || !hasTaskDetail) {
      return;
    }
    const node = overviewPaneRef.current;
    if (!node) {
      return;
    }
    stickToBottomRef.current = true;
    node.scrollTop = node.scrollHeight;
  }, [activeTab, hasTaskDetail, selection.selectedTaskId]);

  useEffect(() => {
    if (activeTab !== 0 || !hasTaskDetail) {
      return;
    }
    const node = overviewPaneRef.current;
    if (!node || !stickToBottomRef.current) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [activeTab, hasTaskDetail, logUpdateToken]);

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
          <Box
            className="task-detail-pane"
            onScroll={() => {
              const node = overviewPaneRef.current;
              if (!node) {
                return;
              }
              const threshold = 24;
              const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
              stickToBottomRef.current = distanceFromBottom <= threshold;
            }}
            ref={overviewPaneRef}
          >
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
