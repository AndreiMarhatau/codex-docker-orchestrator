import { Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { EFFORT_LABELS, MODEL_CUSTOM_VALUE, MODEL_OPTIONS } from '../../../constants.js';
import { getEffortOptionsForModel } from '../../../model-helpers.js';
import TaskDockerToggle from './TaskDockerToggle.jsx';

function TaskFormModel({ handleTaskModelChoiceChange, setTaskForm, taskForm }) {
  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.7}>
        <TextField
          select
          label="Model (optional)"
          fullWidth
          value={taskForm.modelChoice}
          onChange={(event) => handleTaskModelChoiceChange(event.target.value)}
          className="task-compose-field"
        >
          {MODEL_OPTIONS.map((option) => (
            <MenuItem key={option.value || 'default'} value={option.value}>
              {option.value === '' ? 'Default (recommended)' : option.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography className="task-compose-helper">
          If not specified, the default model will be used.
        </Typography>
      </Stack>

      {taskForm.modelChoice === MODEL_CUSTOM_VALUE && (
        <TextField
          label="Custom model"
          fullWidth
          value={taskForm.customModel}
          onChange={(event) => setTaskForm((prev) => ({ ...prev, customModel: event.target.value }))}
          className="task-compose-field"
        />
      )}

      <Stack spacing={0.7}>
        {taskForm.modelChoice === MODEL_CUSTOM_VALUE ? (
          <TextField
            label="Effort (optional)"
            fullWidth
            value={taskForm.customReasoningEffort}
            onChange={(event) =>
              setTaskForm((prev) => ({
                ...prev,
                customReasoningEffort: event.target.value
              }))
            }
            className="task-compose-field"
            placeholder="Default"
          />
        ) : (
          <TextField
            select
            label="Effort (optional)"
            fullWidth
            value={taskForm.reasoningEffort}
            onChange={(event) =>
              setTaskForm((prev) => ({
                ...prev,
                reasoningEffort: event.target.value
              }))
            }
            className="task-compose-field"
          >
            <MenuItem value="">Default</MenuItem>
            {(taskForm.modelChoice ? getEffortOptionsForModel(taskForm.modelChoice) : []).map((effort) => (
              <MenuItem key={effort} value={effort}>
                {EFFORT_LABELS[effort] || effort}
              </MenuItem>
            ))}
          </TextField>
        )}
        <Typography className="task-compose-helper">
          If not specified, the default effort will be used.
        </Typography>
      </Stack>

      <TaskDockerToggle
        checked={taskForm.useHostDockerSocket}
        onChange={(event) =>
          setTaskForm((prev) => ({
            ...prev,
            useHostDockerSocket: event.target.checked
          }))
        }
        warningTooltip="Runs Docker using the orchestrator's isolated per-task sidecar daemon."
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={taskForm.autoReview}
            onChange={(event) =>
              setTaskForm((prev) => ({
                ...prev,
                autoReview: event.target.checked
              }))
            }
          />
        }
        label="Auto review changed runs"
      />
    </Stack>
  );
}

export default TaskFormModel;
