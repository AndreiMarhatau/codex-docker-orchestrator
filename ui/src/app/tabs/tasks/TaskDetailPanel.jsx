/* eslint-disable max-lines, max-lines-per-function */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import TaskDetailActions from './detail/TaskDetailActions.jsx';
import TaskDetailHeader from './detail/TaskDetailHeader.jsx';
import TaskDetailSummaryCard from './detail/TaskDetailSummaryCard.jsx';
import TaskDiff from './detail/TaskDiff.jsx';
import TaskRunOverrides from './detail/TaskRunOverrides.jsx';
import TaskRuns from './detail/TaskRuns.jsx';
import { readDetailTabQuery, writeDetailTabQuery } from '../../query-state.js';

function DetailTabButton({ active, controls, label, onClick, onKeyDown, tabId }) {
  return (
    <button
      type="button"
      className={`task-detail-mode${active ? ' is-active' : ''}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      id={tabId}
      aria-controls={controls}
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
    >
      {label}
    </button>
  );
}

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

  const focusDetailTab = (value) => {
    if (typeof window === 'undefined') {
      return;
    }
    const tabId = value === 0 ? 'task-detail-tab-overview' : 'task-detail-tab-diff';
    window.requestAnimationFrame(() => {
      document.getElementById(tabId)?.focus();
    });
  };

  const handleDetailTabKeyDown = (currentTab, event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    if (event.key === 'Home') {
      setActiveTab(0);
      focusDetailTab(0);
      return;
    }
    if (event.key === 'End') {
      setActiveTab(1);
      focusDetailTab(1);
      return;
    }
    const nextTab = currentTab === 0 ? 1 : 0;
    setActiveTab(nextTab);
    focusDetailTab(nextTab);
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

  return (
    <Box className="task-detail-shell">
      {!hasTaskDetail && (
        <Box className="task-detail-pane task-detail-pane--overview">
          <Typography color="text.secondary">Loading task details...</Typography>
        </Box>
      )}

      {hasTaskDetail && activeTab === 0 && (
        <>
          <TaskDetailHeader tasksState={tasksState} loading={data.loading} />
          <Box className="task-detail-modebar" role="tablist" aria-label="Task detail views">
            <DetailTabButton
              active={activeTab === 0}
              controls="task-detail-panel-overview"
              label="Overview"
              onClick={() => setActiveTab(0)}
              onKeyDown={(event) => handleDetailTabKeyDown(0, event)}
              tabId="task-detail-tab-overview"
            />
            <DetailTabButton
              active={activeTab === 1}
              controls="task-detail-panel-diff"
              label="Diff"
              onClick={() => setActiveTab(1)}
              onKeyDown={(event) => handleDetailTabKeyDown(1, event)}
              tabId="task-detail-tab-diff"
            />
          </Box>
          <Box
            className="task-detail-pane task-detail-pane--overview"
            id="task-detail-panel-overview"
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
            role="tabpanel"
            aria-labelledby="task-detail-tab-overview"
          >
            <TaskDetailSummaryCard taskDetail={detail.taskDetail} />
            <TaskRunOverrides tasksState={tasksState} />
            <TaskRuns tasksState={tasksState} />
          </Box>
        </>
      )}

      {hasTaskDetail && activeTab === 1 && (
        <>
          <TaskDetailHeader tasksState={tasksState} loading={data.loading} />
          <Box className="task-detail-modebar" role="tablist" aria-label="Task detail views">
            <DetailTabButton
              active={activeTab === 0}
              controls="task-detail-panel-overview"
              label="Overview"
              onClick={() => setActiveTab(0)}
              onKeyDown={(event) => handleDetailTabKeyDown(0, event)}
              tabId="task-detail-tab-overview"
            />
            <DetailTabButton
              active={activeTab === 1}
              controls="task-detail-panel-diff"
              label="Diff"
              onClick={() => setActiveTab(1)}
              onKeyDown={(event) => handleDetailTabKeyDown(1, event)}
              tabId="task-detail-tab-diff"
            />
          </Box>
          <Box
            className="task-detail-pane task-detail-pane--diff"
            id="task-detail-panel-diff"
            role="tabpanel"
            aria-labelledby="task-detail-tab-diff"
          >
            <TaskDetailSummaryCard taskDetail={detail.taskDetail} />
            <TaskDiff tasksState={tasksState} />
          </Box>
        </>
      )}

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
