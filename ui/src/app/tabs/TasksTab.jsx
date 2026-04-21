import { Box } from '@mui/material';
import TaskDetailPanel from './tasks/TaskDetailPanel.jsx';
import TasksOverview from './tasks/TasksOverview.jsx';

function TasksTab({ data, tasksState }) {
  const { selectedTaskId } = tasksState.selection;

  return (
    <Box className="tasks-workspace fade-in">
      {selectedTaskId ? (
        <Box className="tasks-workspace-detail tasks-workspace-detail--open">
          <TaskDetailPanel data={data} tasksState={tasksState} />
        </Box>
      ) : (
        <Box className="tasks-workspace-board">
          <TasksOverview data={data} tasksState={tasksState} compact={false} />
        </Box>
      )}
    </Box>
  );
}

export default TasksTab;
