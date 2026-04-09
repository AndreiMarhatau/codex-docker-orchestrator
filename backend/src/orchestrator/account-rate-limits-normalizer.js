function readNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function readBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return null;
}

function readString(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

function normalizeWindowName(name) {
  const trimmed = readString(name);
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/_window$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function normalizeRateLimitWindow(window) {
  if (!window || typeof window !== 'object') {
    return null;
  }
  const usedPercent = readNumber(window.usedPercent, window.used_percent);
  const limitWindowSeconds = readNumber(window.limitWindowSeconds, window.limit_window_seconds);
  const windowDurationMins =
    readNumber(window.windowDurationMins, window.window_duration_mins) ??
    (limitWindowSeconds !== null ? limitWindowSeconds / 60 : null);
  const resetsAt = readNumber(window.resetsAt, window.reset_at);
  const resetAfterSeconds = readNumber(window.resetAfterSeconds, window.reset_after_seconds);
  if ([usedPercent, windowDurationMins, resetsAt, resetAfterSeconds].every((value) => value === null)) {
    return null;
  }
  return { usedPercent, windowDurationMins, resetsAt, resetAfterSeconds };
}

function collectWindows(source) {
  if (!source || typeof source !== 'object') {
    return {};
  }
  const windows = {};
  const addWindow = (name, value) => {
    const normalizedName = normalizeWindowName(name);
    const normalizedWindow = normalizeRateLimitWindow(value);
    if (normalizedName && normalizedWindow) {
      windows[normalizedName] = normalizedWindow;
    }
  };

  addWindow('primary', source.primary);
  addWindow('secondary', source.secondary);
  addWindow('primary_window', source.primary_window);
  addWindow('secondary_window', source.secondary_window);
  if (source.windows && typeof source.windows === 'object') {
    for (const [key, value] of Object.entries(source.windows)) {
      addWindow(key, value);
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (
      key !== 'primary' &&
      key !== 'secondary' &&
      key !== 'primary_window' &&
      key !== 'secondary_window' &&
      key !== 'windows' &&
      /_window$/i.test(key)
    ) {
      addWindow(key, value);
    }
  }
  return windows;
}

function normalizeCredits(credits) {
  if (!credits || typeof credits !== 'object') {
    return null;
  }
  const normalized = {
    hasCredits: readBoolean(credits.hasCredits, credits.has_credits),
    unlimited: readBoolean(credits.unlimited),
    overageLimitReached: readBoolean(credits.overageLimitReached, credits.overage_limit_reached),
    balance: readString(credits.balance),
    approxLocalMessages: Array.isArray(credits.approxLocalMessages)
      ? credits.approxLocalMessages
      : Array.isArray(credits.approx_local_messages)
        ? credits.approx_local_messages
        : null,
    approxCloudMessages: Array.isArray(credits.approxCloudMessages)
      ? credits.approxCloudMessages
      : Array.isArray(credits.approx_cloud_messages)
        ? credits.approx_cloud_messages
        : null
  };
  return Object.values(normalized).every((value) => value === null) ? null : normalized;
}

function normalizeAdditionalRateLimit(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const section = entry.rateLimit || entry.rate_limit || entry;
  const windows = collectWindows(section);
  return {
    limitName: readString(entry.limitName, entry.limit_name),
    meteredFeature: readString(entry.meteredFeature, entry.metered_feature),
    allowed: readBoolean(entry.allowed, section.allowed),
    limitReached: readBoolean(entry.limitReached, entry.limit_reached, section.limitReached, section.limit_reached),
    primary: windows.primary || null,
    secondary: windows.secondary || null,
    windows
  };
}

function normalizeRateLimits(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return null;
  }
  const baseSection = rateLimits.rateLimit || rateLimits.rate_limit || rateLimits;
  const windows = collectWindows(baseSection);
  const additionalEntries = Array.isArray(rateLimits.additionalRateLimits)
    ? rateLimits.additionalRateLimits
    : Array.isArray(rateLimits.additional_rate_limits)
      ? rateLimits.additional_rate_limits
      : [];
  const codeReviewRateLimit = normalizeAdditionalRateLimit(
    rateLimits.codeReviewRateLimit || rateLimits.code_review_rate_limit
  );

  const normalized = {
    primary: windows.primary || null,
    secondary: windows.secondary || null,
    windows,
    allowed: readBoolean(baseSection.allowed, rateLimits.allowed),
    limitReached: readBoolean(baseSection.limitReached, baseSection.limit_reached, rateLimits.limitReached, rateLimits.limit_reached),
    credits: normalizeCredits(rateLimits.credits),
    planType: readString(rateLimits.planType, rateLimits.plan_type)
  };
  if (additionalEntries.length > 0) {
    normalized.additionalRateLimits = additionalEntries.map(normalizeAdditionalRateLimit).filter(Boolean);
  }
  if (codeReviewRateLimit) {
    normalized.codeReviewRateLimit = codeReviewRateLimit;
  }
  return normalized;
}

function collectBaseRateLimitWindows(rateLimits) {
  if (!rateLimits || typeof rateLimits !== 'object') {
    return [];
  }
  const baseWindows = rateLimits.windows && typeof rateLimits.windows === 'object'
    ? Object.values(rateLimits.windows)
    : [rateLimits.primary, rateLimits.secondary];
  return baseWindows.filter((entry) => entry && typeof entry.usedPercent === 'number');
}

module.exports = {
  collectBaseRateLimitWindows,
  normalizeRateLimits,
  readString
};
