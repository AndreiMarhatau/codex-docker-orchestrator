/* eslint-disable max-lines, max-lines-per-function */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import TaskDetailActions from './detail/TaskDetailActions.jsx';
import TaskArtifacts from './detail/TaskArtifacts.jsx';
import TaskDetailHeader from './detail/TaskDetailHeader.jsx';
import TaskDetailSummaryCard from './detail/TaskDetailSummaryCard.jsx';
import TaskDiff from './detail/TaskDiff.jsx';
import TaskRuns from './detail/TaskRuns.jsx';
import TaskDeleteConfirmationDialog from './TaskDeleteConfirmationDialog.jsx';
import TaskStopConfirmationDialog from './TaskStopConfirmationDialog.jsx';
import { readDetailTabQuery, writeDetailTabQuery } from '../../query-state.js';
import useTaskDeleteConfirmation from './useTaskDeleteConfirmation.js';
import useTaskStopConfirmation from './useTaskStopConfirmation.js';

const DETAIL_TABS = [
  { label: 'Overview', panelId: 'task-detail-panel-overview', tabId: 'task-detail-tab-overview' },
  { label: 'Diff', panelId: 'task-detail-panel-diff', tabId: 'task-detail-tab-diff' },
  { label: 'Artifacts', panelId: 'task-detail-panel-artifacts', tabId: 'task-detail-tab-artifacts' }
];

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

function DetailModeBar({ activeTab, onKeyDown, setActiveTab }) {
  return (
    <Box className="task-detail-modebar" role="tablist" aria-label="Task detail views">
      {DETAIL_TABS.map((tab, index) => (
        <DetailTabButton
          active={activeTab === index}
          controls={tab.panelId}
          key={tab.tabId}
          label={tab.label}
          onClick={() => setActiveTab(index)}
          onKeyDown={(event) => onKeyDown(index, event)}
          tabId={tab.tabId}
        />
      ))}
    </Box>
  );
}

function TaskDetailPanel({ data, tasksState }) {
  const { detail, selection } = tasksState;
  const { now } = tasksState;
  const hasTaskDetail = Boolean(detail.taskDetail);
  const taskDelete = useTaskDeleteConfirmation({
    handleDeleteTask: tasksState.actions.handleDeleteTask,
    loading: data.loading
  });
  const taskStop = useTaskStopConfirmation({
    handleStopTask: tasksState.actions.handleStopTask,
    loading: data.loading
  });
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
    const tabId = DETAIL_TABS[value]?.tabId || DETAIL_TABS[0].tabId;
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
      const lastTab = DETAIL_TABS.length - 1;
      setActiveTab(lastTab);
      focusDetailTab(lastTab);
      return;
    }
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextTab = (currentTab + offset + DETAIL_TABS.length) % DETAIL_TABS.length;
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
    return (
      status === 'running' ||
      status === 'reviewing' ||
      status === 'pushing' ||
      status === 'stopping'
    );
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

  const showCommitPush = useMemo(() => {
    const gitStatus = detail.taskDetail?.gitStatus;
    if (!gitStatus) {
      return false;
    }
    return gitStatus.dirty === true || gitStatus.pushed === false;
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
          <TaskDetailHeader
            now={now}
            onRequestDeleteTask={taskDelete.requestDeleteTask}
            onRequestStopTask={taskStop.requestStopTask}
            tasksState={tasksState}
            loading={data.loading}
          />
          <DetailModeBar
            activeTab={activeTab}
            onKeyDown={handleDetailTabKeyDown}
            setActiveTab={setActiveTab}
          />
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
            <TaskDetailSummaryCard now={now} taskDetail={detail.taskDetail} />
            <TaskRuns tasksState={tasksState} />
          </Box>
        </>
      )}

      {hasTaskDetail && activeTab === 1 && (
        <>
          <TaskDetailHeader
            now={now}
            onRequestDeleteTask={taskDelete.requestDeleteTask}
            onRequestStopTask={taskStop.requestStopTask}
            tasksState={tasksState}
            loading={data.loading}
          />
          <DetailModeBar
            activeTab={activeTab}
            onKeyDown={handleDetailTabKeyDown}
            setActiveTab={setActiveTab}
          />
          <Box
            className="task-detail-pane task-detail-pane--diff"
            id="task-detail-panel-diff"
            role="tabpanel"
            aria-labelledby="task-detail-tab-diff"
          >
            <TaskDetailSummaryCard now={now} taskDetail={detail.taskDetail} />
            <TaskDiff tasksState={tasksState} />
          </Box>
        </>
      )}

      {hasTaskDetail && activeTab === 2 && (
        <>
          <TaskDetailHeader
            now={now}
            onRequestDeleteTask={taskDelete.requestDeleteTask}
            onRequestStopTask={taskStop.requestStopTask}
            tasksState={tasksState}
            loading={data.loading}
          />
          <DetailModeBar
            activeTab={activeTab}
            onKeyDown={handleDetailTabKeyDown}
            setActiveTab={setActiveTab}
          />
          <Box
            className="task-detail-pane task-detail-pane--artifacts"
            id="task-detail-panel-artifacts"
            role="tabpanel"
            aria-labelledby="task-detail-tab-artifacts"
          >
            <TaskDetailSummaryCard now={now} taskDetail={detail.taskDetail} />
            <TaskArtifacts tasksState={tasksState} />
          </Box>
        </>
      )}

      <TaskDetailActions
        data={data}
        hasTaskDetail={hasTaskDetail}
        isRunning={isRunning}
        onRequestDeleteTask={taskDelete.requestDeleteTask}
        onRequestStopTask={taskStop.requestStopTask}
        showCommitPush={showCommitPush}
        tasksState={tasksState}
      />
      <TaskDeleteConfirmationDialog {...taskDelete.deleteDialogProps} />
      <TaskStopConfirmationDialog {...taskStop.stopDialogProps} />
    </Box>
  );
}

export default TaskDetailPanel;
