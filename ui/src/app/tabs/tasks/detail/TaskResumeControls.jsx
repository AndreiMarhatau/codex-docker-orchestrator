import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RunOverrideForm from './RunOverrideForm.jsx';
import { formatEffortDisplay, formatModelDisplay } from '../../../model-helpers.js';

function TaskResumeControls({ loading, tasksState }) {
  const { actions, detail, handleResumeModelChoiceChange } = tasksState;
  const { taskDetail } = detail;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Run overrides</Typography>
      <Typography color="text.secondary" variant="body2">
        Default: model {formatModelDisplay(taskDetail.model)} · effort{' '}
        {formatEffortDisplay(taskDetail.reasoningEffort)}
      </Typography>
      <RunOverrideForm
        detail={detail}
        handleResumeModelChoiceChange={handleResumeModelChoiceChange}
      />
      <TextField
        label="Resume prompt"
        fullWidth
        multiline
        minRows={3}
        value={detail.resumePrompt}
        onChange={(event) => detail.setResumePrompt(event.target.value)}
      />
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControlLabel
          control={
            <Checkbox
              checked={detail.resumeUseHostDockerSocket}
              onChange={(event) => {
                detail.setResumeUseHostDockerSocket(event.target.checked);
                detail.setResumeDockerTouched(true);
              }}
            />
          }
          label="Use host Docker socket for this run"
        />
        <Tooltip title="Grants root-equivalent access to the host via Docker. Disable if you do not trust the task.">
          <WarningAmberIcon color="warning" fontSize="small" />
        </Tooltip>
      </Stack>
      <Box className="task-resume-actions">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button
            variant="contained"
            onClick={actions.handleResumeTask}
            disabled={loading || !detail.resumePrompt.trim()}
          >
            Continue task
          </Button>
          <Button variant="outlined" onClick={actions.handlePushTask} disabled={loading}>
            Push
          </Button>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Stop task">
              <span>
                <Button
                  color="error"
                  onClick={() => actions.handleStopTask(taskDetail.taskId)}
                  disabled={loading || taskDetail.status !== 'running'}
                  aria-label="Stop task"
                  startIcon={<StopCircleOutlinedIcon />}
                >
                  Stop task
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Remove task">
              <span>
                <Button
                  color="secondary"
                  onClick={() => actions.handleDeleteTask(taskDetail.taskId)}
                  disabled={loading}
                  aria-label="Remove task"
                  startIcon={<DeleteOutlineIcon />}
                >
                  Remove task
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

export default TaskResumeControls;
