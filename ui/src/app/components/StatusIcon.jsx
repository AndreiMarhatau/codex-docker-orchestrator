import { Box, Tooltip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { STATUS_CONFIG } from '../constants.js';

const STATUS_ICONS = {
  running: PlayCircleOutlineIcon,
  stopping: HourglassTopIcon,
  completed: CheckCircleOutlineIcon,
  failed: ErrorOutlineIcon,
  stopped: PauseCircleOutlineIcon,
  unknown: HelpOutlineIcon
};

function StatusIcon({ status, size = 'small' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = STATUS_ICONS[status] || STATUS_ICONS.unknown;
  return (
    <Tooltip title={config.label}>
      <Box
        component="span"
        aria-label={config.label}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: '999px',
          backgroundColor: config.bg,
          color: config.fg,
          border: `1px solid ${config.border}`
        }}
      >
        <Icon fontSize={size} />
      </Box>
    </Tooltip>
  );
}

export default StatusIcon;
