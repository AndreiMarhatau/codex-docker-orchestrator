import { useId } from 'react';
import { Checkbox, Stack, Tooltip, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

function TaskDockerToggle({
  checked,
  disabled = false,
  helperText = 'Run the agent in a Docker container.',
  onChange,
  warningTooltip = ''
}) {
  const checkboxId = useId();
  const labelId = `${checkboxId}-label`;
  const helperId = `${checkboxId}-helper`;
  const warningIcon = (
    <WarningAmberIcon className="task-compose-warning" color="warning" fontSize="small" />
  );

  return (
    <div className="task-compose-toggle-block">
      <Checkbox
        id={checkboxId}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="task-compose-toggle-checkbox"
        inputProps={{
          'aria-describedby': helperId,
          'aria-labelledby': labelId
        }}
      />
      <Stack spacing={0.35} className="task-compose-toggle-copy">
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          className="task-compose-toggle-row"
        >
          <Typography
            id={labelId}
            component="label"
            htmlFor={checkboxId}
            className="task-compose-checkbox-label"
          >
            Enable Docker
          </Typography>
          {warningTooltip ? <Tooltip title={warningTooltip}>{warningIcon}</Tooltip> : warningIcon}
        </Stack>
        <Typography id={helperId} className="task-compose-helper">
          {helperText}
        </Typography>
      </Stack>
    </div>
  );
}

export default TaskDockerToggle;
