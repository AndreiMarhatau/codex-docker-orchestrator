import { memo, useEffect, useMemo, useState } from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DesktopTaskRow, MobileTaskCard } from './TaskListRow.jsx';

const MOBILE_TASK_LIMIT = 4;

function DesktopTaskTable({
  handleDeleteTask,
  handleStopTask,
  loading,
  now,
  selectedTaskId,
  setSelectedTaskId,
  tasks
}) {
  return (
    <>
      <Box className="task-table-head">
        <span>Environment</span>
        <span>Branch</span>
        <span>Status</span>
        <span>Git Status</span>
        <span>Changes</span>
        <span>Actions</span>
      </Box>

      <Box className="task-table-body">
        {tasks.map((task) => (
          <DesktopTaskRow
            key={task.taskId}
            handleDeleteTask={handleDeleteTask}
            handleStopTask={handleStopTask}
            loading={loading}
            now={now}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            task={task}
          />
        ))}
      </Box>
    </>
  );
}

function MobileTaskTable({
  handleDeleteTask,
  handleStopTask,
  loading,
  now,
  selectedTaskId,
  setSelectedTaskId,
  tasks
}) {
  const [showAll, setShowAll] = useState(false);
  const taskIdentity = useMemo(
    () => tasks.map((task) => task.taskId).join(':'),
    [tasks]
  );
  const mobileTasks = useMemo(
    () => (showAll ? tasks : tasks.slice(0, MOBILE_TASK_LIMIT)),
    [showAll, tasks]
  );

  useEffect(() => {
    setShowAll(false);
  }, [taskIdentity]);

  return (
    <Box className="task-mobile-list">
      {mobileTasks.map((task) => (
        <MobileTaskCard
          key={task.taskId}
          handleDeleteTask={handleDeleteTask}
          handleStopTask={handleStopTask}
          loading={loading}
          now={now}
          selectedTaskId={selectedTaskId}
          setSelectedTaskId={setSelectedTaskId}
          task={task}
        />
      ))}
      {!showAll && tasks.length > MOBILE_TASK_LIMIT && (
        <button type="button" className="task-mobile-more" onClick={() => setShowAll(true)}>
          View more
        </button>
      )}
    </Box>
  );
}

function EmptyTaskList() {
  return (
    <Box className="task-table-shell task-table-shell--empty">
      <Box className="empty-state">
        <Typography color="text.secondary">No tasks yet. Create one to get started.</Typography>
      </Box>
    </Box>
  );
}

function TaskList({
  data,
  handleDeleteTask,
  handleStopTask,
  now,
  selectedTaskId,
  setSelectedTaskId,
  visibleTasks
}) {
  const theme = useTheme();
  const mobileLayout = useMediaQuery(theme.breakpoints.down('md'));
  const { loading } = data;

  if (visibleTasks.length === 0) {
    return <EmptyTaskList />;
  }

  return (
    <Box className="task-table-shell">
      {mobileLayout ? (
        <MobileTaskTable
          handleDeleteTask={handleDeleteTask}
          handleStopTask={handleStopTask}
          loading={loading}
          now={now}
          selectedTaskId={selectedTaskId}
          setSelectedTaskId={setSelectedTaskId}
          tasks={visibleTasks}
        />
      ) : (
        <DesktopTaskTable
          handleDeleteTask={handleDeleteTask}
          handleStopTask={handleStopTask}
          loading={loading}
          now={now}
          selectedTaskId={selectedTaskId}
          setSelectedTaskId={setSelectedTaskId}
          tasks={visibleTasks}
        />
      )}
    </Box>
  );
}

export default memo(TaskList);
