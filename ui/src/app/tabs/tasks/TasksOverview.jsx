import { Divider, Stack } from '@mui/material';
import TaskFilterBar from './TaskFilterBar.jsx';
import TaskForm from './TaskForm.jsx';
import TaskList from './TaskList.jsx';
import TasksHeader from './TasksHeader.jsx';

function TasksOverview({ data, envState, tasksState }) {
  return (
    <Stack spacing={2}>
      <TasksHeader data={data} tasksState={tasksState} />
      <Divider />
      <TaskFilterBar data={data} tasksState={tasksState} />
      <TaskForm data={data} envState={envState} tasksState={tasksState} />
      <Divider />
      <TaskList data={data} tasksState={tasksState} />
    </Stack>
  );
}

export default TasksOverview;
