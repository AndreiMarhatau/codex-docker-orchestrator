import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { EFFORT_LABELS, MODEL_CUSTOM_VALUE, MODEL_OPTIONS } from '../../../constants.js';
import { getEffortOptionsForModel } from '../../../model-helpers.js';

function TaskFormModel({ handleTaskModelChoiceChange, setTaskForm, taskForm }) {
  return (
    <>
      <Typography variant="subtitle2">Model & effort</Typography>
      <TextField
        select
        label="Model"
        fullWidth
        value={taskForm.modelChoice}
        onChange={(event) => handleTaskModelChoiceChange(event.target.value)}
      >
        {MODEL_OPTIONS.map((option) => (
          <MenuItem key={option.value || 'default'} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      {taskForm.modelChoice === MODEL_CUSTOM_VALUE && (
        <TextField
          label="Custom model"
          fullWidth
          value={taskForm.customModel}
          onChange={(event) => setTaskForm((prev) => ({ ...prev, customModel: event.target.value }))}
        />
      )}
      {taskForm.modelChoice && taskForm.modelChoice !== MODEL_CUSTOM_VALUE && (
        <TextField
          select
          label="Reasoning effort"
          fullWidth
          value={taskForm.reasoningEffort}
          onChange={(event) =>
            setTaskForm((prev) => ({
              ...prev,
              reasoningEffort: event.target.value
            }))
          }
        >
          <MenuItem value="">Default (model default)</MenuItem>
          {getEffortOptionsForModel(taskForm.modelChoice).map((effort) => (
            <MenuItem key={effort} value={effort}>
              {EFFORT_LABELS[effort] || effort}
            </MenuItem>
          ))}
        </TextField>
      )}
      {taskForm.modelChoice === MODEL_CUSTOM_VALUE && (
        <TextField
          label="Custom reasoning effort"
          fullWidth
          value={taskForm.customReasoningEffort}
          onChange={(event) =>
            setTaskForm((prev) => ({
              ...prev,
              customReasoningEffort: event.target.value
            }))
          }
          placeholder="none | low | medium | high | xhigh"
        />
      )}
      <Typography color="text.secondary" variant="body2">
        Effort options are filtered by model support. Leave blank to use the model default.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <FormControlLabel
          control={
            <Checkbox
              checked={taskForm.useHostDockerSocket}
              onChange={(event) =>
                setTaskForm((prev) => ({
                  ...prev,
                  useHostDockerSocket: event.target.checked
                }))
              }
            />
          }
          label="Use host Docker socket"
        />
        <Tooltip title="Grants root-equivalent access to the host via Docker. Enable only if you trust the task.">
          <WarningAmberIcon color="warning" fontSize="small" />
        </Tooltip>
      </Stack>
    </>
  );
}

export default TaskFormModel;
