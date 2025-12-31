import { Box, Card, CardContent } from '@mui/material';
import TaskDetailPanel from './tasks/TaskDetailPanel.jsx';
import TasksOverview from './tasks/TasksOverview.jsx';

function TasksTab({ data, envState, tasksState }) {
  const { selectedTaskId } = tasksState.selection;
  const panelContentClass = selectedTaskId
    ? 'panel-content panel-content--flush'
    : 'panel-content';

  return (
    <Box className="section-shell fade-in">
      <Card className="panel-card">
        <CardContent className={panelContentClass}>
          {!selectedTaskId ? (
            <TasksOverview data={data} envState={envState} tasksState={tasksState} />
          ) : (
            <TaskDetailPanel data={data} tasksState={tasksState} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default TasksTab;
