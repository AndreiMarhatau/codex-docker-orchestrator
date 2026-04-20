import { Stack } from '@mui/material';
import TaskFilterBar from './TaskFilterBar.jsx';
import TaskForm from './TaskForm.jsx';
import TaskList from './TaskList.jsx';
import TasksHeader from './TasksHeader.jsx';

function TasksOverview({ data, tasksState }) {
  return (
    <Stack spacing={2.5}>
      <TasksHeader tasksState={tasksState} />
      <TaskList
        data={data}
        handleDeleteTask={tasksState.listActions.handleDeleteTask}
        handleStopTask={tasksState.listActions.handleStopTask}
        now={tasksState.now}
        selectedTaskId={tasksState.selection.selectedTaskId}
        setSelectedTaskId={tasksState.selection.setSelectedTaskId}
        visibleTasks={tasksState.visibleTasks}
      />
      <TaskFilterBar data={data} tasksState={tasksState} />
      <TaskForm data={data} tasksState={tasksState} />
    </Stack>
  );
}

export default TasksOverview;
