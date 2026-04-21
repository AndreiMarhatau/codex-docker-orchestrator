import { useMemo } from 'react';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import {
  formatDurationFromMinutes,
  formatEpochSeconds,
  formatPercent,
  formatRelativeTimeFromEpochSeconds,
  formatTimestamp
} from '../../formatters.js';
import { formatAccountLabel } from '../../repo-helpers.js';

function RateLimitWindow({ label, window }) {
  const hasWindow = window && typeof window === 'object';
  const leftPercent =
    hasWindow && Number.isFinite(window.usedPercent)
      ? Math.min(100, Math.max(0, 100 - window.usedPercent))
      : 'unknown';
  const leftDisplay = formatPercent(leftPercent);
  const windowDuration = hasWindow
    ? formatDurationFromMinutes(window.windowDurationMins)
    : 'unknown';
  const resetsAt = hasWindow ? formatEpochSeconds(window.resetsAt) : 'unknown';
  const resetsRelative = hasWindow
    ? formatRelativeTimeFromEpochSeconds(window.resetsAt)
    : 'unknown';
  const resetsDisplay = resetsRelative === 'unknown' ? resetsAt : `${resetsAt} (${resetsRelative})`;

  return (
    <Box className="dense-metric-card">
      <Stack spacing={0.35}>
        <Typography variant="subtitle2" className="dense-metric-title">{label}</Typography>
        {hasWindow ? (
          <>
            <Typography variant="body2">Left: {leftDisplay}</Typography>
            <Typography variant="body2">Window: {windowDuration}</Typography>
            <Typography variant="body2">Resets: {resetsDisplay}</Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No data.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function UsageLimits({ accountsState }) {
  const {
    activeAccount,
    rateLimits,
    rateLimitsError,
    rateLimitsFetchedAt,
    rateLimitsLoading,
    refreshRateLimits,
    triggerUsage,
    triggerUsageError,
    triggerUsageLoading,
    triggerUsageTriggeredAt
  } = accountsState;

  const creditsSummary = useMemo(() => {
    const credits = rateLimits?.credits;
    if (!credits) {
      return 'No credit data.';
    }
    if (!credits.hasCredits) {
      return 'No credits available.';
    }
    if (credits.unlimited) {
      return 'Unlimited credits.';
    }
    if (credits.balance) {
      return `Balance: ${credits.balance}`;
    }
    return 'Credits available.';
  }, [rateLimits]);

  return (
    <Box className="dense-panel dense-panel--list">
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Stack spacing={0.35}>
            <Typography variant="h6" className="dense-panel-title">Usage limits</Typography>
            <Typography color="text.secondary" className="dense-panel-copy">
              {activeAccount
                ? `Active account: ${formatAccountLabel(activeAccount)}`
                : 'No active account selected. Pick one before checking limits.'}
            </Typography>
          </Stack>
          <Stack className="dense-actions" direction="row" spacing={0.75} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              onClick={refreshRateLimits}
              disabled={rateLimitsLoading || triggerUsageLoading}
            >
              Check usage limits
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={triggerUsage}
              disabled={rateLimitsLoading || triggerUsageLoading}
            >
              Trigger usage
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" className="dense-panel-copy">
          This view shows the windows that matter for rotation decisions and whether credits are
          still available.
        </Typography>
        {triggerUsageLoading && (
          <Typography color="text.secondary">Triggering usage...</Typography>
        )}
        {triggerUsageError && <Typography color="error">{triggerUsageError}</Typography>}
        {rateLimitsLoading && (
          <Typography color="text.secondary">Loading usage limits...</Typography>
        )}
        {rateLimitsError && <Typography color="error">{rateLimitsError}</Typography>}
        {!rateLimitsLoading && !rateLimitsError && !rateLimits && (
          <Typography color="text.secondary">Usage limits have not been loaded yet.</Typography>
        )}
        {rateLimits && (
          <Stack spacing={1.25}>
            <Stack className="dense-metric-grid" spacing={1}>
              <RateLimitWindow label="Primary window" window={rateLimits.primary} />
              <RateLimitWindow label="Secondary window" window={rateLimits.secondary} />
            </Stack>
            <Divider />
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Credits</Typography>
              <Typography variant="body2">{creditsSummary}</Typography>
              {rateLimits.planType && (
                <Typography variant="body2">Plan: {rateLimits.planType}</Typography>
              )}
            </Stack>
          </Stack>
        )}
        {rateLimitsFetchedAt && (
          <Typography variant="caption" color="text.secondary">
            Last checked {formatTimestamp(rateLimitsFetchedAt)}
          </Typography>
        )}
        {triggerUsageTriggeredAt && (
          <Typography variant="caption" color="text.secondary">
            Last usage trigger {formatTimestamp(triggerUsageTriggeredAt)}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

export default UsageLimits;
