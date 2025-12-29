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

function UsageLimits({ accountsState }) {
  const {
    activeAccount,
    rateLimits,
    rateLimitsError,
    rateLimitsFetchedAt,
    rateLimitsLoading,
    refreshRateLimits
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

  const renderRateLimitWindow = (label, window) => {
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
      <Box
        sx={{
          flex: 1,
          minWidth: 200,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          padding: 1.5
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">{label}</Typography>
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
  };

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Usage limits</Typography>
          <Typography color="text.secondary">
            {activeAccount
              ? `Active account: ${formatAccountLabel(activeAccount)}`
              : 'No active account selected.'}
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={refreshRateLimits}
          disabled={rateLimitsLoading}
        >
          Check usage limits
        </Button>
      </Stack>
      {rateLimitsLoading && (
        <Typography color="text.secondary">Loading usage limits...</Typography>
      )}
      {rateLimitsError && <Typography color="error">{rateLimitsError}</Typography>}
      {!rateLimitsLoading && !rateLimitsError && !rateLimits && (
        <Typography color="text.secondary">Usage limits have not been loaded yet.</Typography>
      )}
      {rateLimits && (
        <Box className="log-box">
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {renderRateLimitWindow('Primary', rateLimits.primary)}
              {renderRateLimitWindow('Secondary', rateLimits.secondary)}
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
        </Box>
      )}
      {rateLimitsFetchedAt && (
        <Typography variant="caption" color="text.secondary">
          Last checked {formatTimestamp(rateLimitsFetchedAt)}
        </Typography>
      )}
    </>
  );
}

export default UsageLimits;
