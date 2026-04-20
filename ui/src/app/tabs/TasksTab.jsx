import { Box } from '@mui/material';
import TaskDetailPanel from './tasks/TaskDetailPanel.jsx';
import TasksOverview from './tasks/TasksOverview.jsx';

function TasksTab({ data, tasksState }) {
  const { selectedTaskId } = tasksState.selection;
  const workspaceClassName = `tasks-workspace${selectedTaskId ? ' tasks-workspace--detail-open' : ''}`;
  const detailClassName = `tasks-workspace-detail${selectedTaskId ? ' tasks-workspace-detail--open' : ''}`;

  return (
    <Box className={`${workspaceClassName} fade-in`}>
      <Box className="tasks-workspace-board">
        <TasksOverview data={data} tasksState={tasksState} />
      </Box>
      <Box className={detailClassName}>
        {selectedTaskId ? (
          <TaskDetailPanel data={data} tasksState={tasksState} />
        ) : (
          <Box className="task-detail-placeholder">
            <Box className="task-detail-placeholder-mark">Open a task</Box>
            <Box className="task-detail-placeholder-body">
              Select a row to jump straight into the latest agent message, artifacts, and git state.
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default TasksTab;
