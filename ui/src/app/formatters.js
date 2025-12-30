function formatTimestamp(value) {
  if (!value) {
    return 'unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatEpochSeconds(value) {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return date.toLocaleString();
}

function formatDurationFromMinutes(value) {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  const absValue = Math.abs(value);
  let unit = 'min';
  let unitMinutes = 1;
  if (absValue >= 60 * 24 * 7) {
    unit = 'wk';
    unitMinutes = 60 * 24 * 7;
  } else if (absValue >= 60 * 24) {
    unit = 'day';
    unitMinutes = 60 * 24;
  } else if (absValue >= 60) {
    unit = 'hr';
    unitMinutes = 60;
  }
  const rounded = Math.round((value / unitMinutes) * 10) / 10;
  const formatted = rounded.toFixed(1);
  const cleaned = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  return `${cleaned} ${unit}`;
}

function formatRelativeTimeFromEpochSeconds(value) {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  const diffMinutes = Math.round((value * 1000 - Date.now()) / 60000);
  if (diffMinutes === 0) {
    return 'now';
  }
  const absMinutes = Math.abs(diffMinutes);
  let unit = 'minute';
  let unitMinutes = 1;
  if (absMinutes >= 60 * 24 * 7) {
    unit = 'week';
    unitMinutes = 60 * 24 * 7;
  } else if (absMinutes >= 60 * 24) {
    unit = 'day';
    unitMinutes = 60 * 24;
  } else if (absMinutes >= 60) {
    unit = 'hour';
    unitMinutes = 60;
  }
  const rounded = Math.round(diffMinutes / unitMinutes);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  return formatter.format(rounded, unit);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded.toFixed(1);
  const cleaned = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  return `${cleaned}%`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatBytes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'unknown size';
  }
  if (value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** order;
  return `${scaled.toFixed(order === 0 ? 0 : 1)} ${units[order]}`;
}

export {
  formatBytes,
  formatDuration,
  formatDurationFromMinutes,
  formatEpochSeconds,
  formatPercent,
  formatRelativeTimeFromEpochSeconds,
  formatTimestamp
};
