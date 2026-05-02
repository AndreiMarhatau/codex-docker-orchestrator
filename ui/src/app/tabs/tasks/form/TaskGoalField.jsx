import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

function TaskGoalField({ disabled = false, minRows = 3, onChange, value }) {
  return (
    <TextField
      label="Goal"
      fullWidth
      multiline
      minRows={minRows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder="Optional long-running goal for Codex to pursue..."
      className="task-compose-field"
      InputProps={{
        endAdornment: value ? (
          <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
            <Tooltip title="Clear goal">
              <IconButton
                aria-label="Clear goal"
                edge="end"
                size="small"
                onClick={() => onChange('')}
                disabled={disabled}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ) : null
      }}
    />
  );
}

export default TaskGoalField;
