import { Box, Card, CardContent, IconButton, Tooltip } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TaskDetailPanel from './tasks/TaskDetailPanel.jsx';
import TasksOverview from './tasks/TasksOverview.jsx';

function TasksTab({ data, envState, tasksState }) {
  const { selectedTaskId } = tasksState.selection;

  return (
    <Box className="section-shell fade-in">
      <Card className="panel-card">
        <CardContent>
          {!selectedTaskId ? (
            <TasksOverview data={data} envState={envState} tasksState={tasksState} />
          ) : (
            <TaskDetailPanel data={data} tasksState={tasksState} />
          )}
        </CardContent>
      </Card>
      {selectedTaskId && tasksState.showScrollTop && (
        <Tooltip title="Scroll to top">
          <IconButton
            color="primary"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Scroll to top"
            sx={{
              position: 'fixed',
              bottom: { xs: 24, md: 32 },
              right: { xs: 16, md: 24 },
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 3,
              zIndex: 10,
              '&:hover': {
                backgroundColor: 'background.paper'
              }
            }}
          >
            <KeyboardArrowUpIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default TasksTab;
