/* eslint-disable max-lines-per-function */
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
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DifferenceOutlinedIcon from '@mui/icons-material/DifferenceOutlined';
import TaskDetailActions from './detail/TaskDetailActions.jsx';
import TaskDetailHeader from './detail/TaskDetailHeader.jsx';
import TaskDiff from './detail/TaskDiff.jsx';
import TaskRunOverrides from './detail/TaskRunOverrides.jsx';
import TaskRuns from './detail/TaskRuns.jsx';
import { readDetailTabQuery, writeDetailTabQuery } from '../../query-state.js';

function TaskDetailPanel({ data, tasksState }) {
  const { detail, selection } = tasksState;
  const hasTaskDetail = Boolean(detail.taskDetail);
  const [activeTab, setActiveTabState] = useState(readDetailTabQuery);
  const overviewPaneRef = useRef(null);
  const stickToBottomRef = useRef(false);
  const lastOverviewStateRef = useRef({
    activeTab: readDetailTabQuery(),
    hasTaskDetail: false,
    selectedTaskId: selection.selectedTaskId
  });

  const setActiveTab = (value) => {
    setActiveTabState(value);
    writeDetailTabQuery(value);
  };
  useEffect(() => {
    setActiveTabState(readDetailTabQuery());
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
  const isRunning = useMemo(() => {
    const status = detail.taskDetail?.status;
    return status === 'running' || status === 'stopping';
  }, [detail.taskDetail?.status]);

  useEffect(() => {
    if (activeTab !== 0 || !hasTaskDetail) {
      lastOverviewStateRef.current = {
        activeTab,
        hasTaskDetail,
        selectedTaskId: selection.selectedTaskId
      };
      return;
    }
    const node = overviewPaneRef.current;
    if (!node) {
      lastOverviewStateRef.current = {
        activeTab,
        hasTaskDetail,
        selectedTaskId: selection.selectedTaskId
      };
      return;
    }
    const previous = lastOverviewStateRef.current;
    const enteringOverview = previous.activeTab !== 0;
    const taskChanged = previous.selectedTaskId !== selection.selectedTaskId;
    const detailLoaded = !previous.hasTaskDetail;

    lastOverviewStateRef.current = {
      activeTab,
      hasTaskDetail,
      selectedTaskId: selection.selectedTaskId
    };

    if (!enteringOverview && !taskChanged && !detailLoaded) {
      return;
    }

    const shouldStickToBottom = isRunning;
    stickToBottomRef.current = shouldStickToBottom;
    node.scrollTop = shouldStickToBottom ? node.scrollHeight : 0;
  }, [activeTab, hasTaskDetail, isRunning, selection.selectedTaskId]);
  useEffect(() => {
    if (activeTab !== 0 || !hasTaskDetail || !isRunning) {
      return;
    }
    const node = overviewPaneRef.current;
    if (!node || !stickToBottomRef.current) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [activeTab, hasTaskDetail, isRunning, logUpdateToken]);
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
            {detail.taskDetail?.repoUrl && (
              <Typography className="task-detail-top-subtitle">
                {detail.taskDetail.repoUrl}
              </Typography>
            )}
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
        <Tab icon={<DashboardOutlinedIcon fontSize="small" />} iconPosition="start" label="Overview" />
        <Tab icon={<DifferenceOutlinedIcon fontSize="small" />} iconPosition="start" label="Diff" />
      </Tabs>
      <Box className="task-detail-content">
        {!hasTaskDetail && (
          <Box className="task-detail-pane task-detail-pane--overview">
            <Typography color="text.secondary">Loading task details...</Typography>
          </Box>
        )}
        {hasTaskDetail && activeTab === 0 && (
          <Box
            className="task-detail-pane task-detail-pane--overview"
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
          <Box className="task-detail-pane task-detail-pane--diff">
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
