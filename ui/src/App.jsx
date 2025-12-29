import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import { apiRequest, apiUrl } from './api.js';

const emptyEnvForm = { repoUrl: '', defaultBranch: 'main' };
const MODEL_CUSTOM_VALUE = 'custom';
const MODEL_OPTIONS = [
  { value: '', label: 'Default (Codex decides)' },
  { value: 'gpt-5.1-codex-mini', label: 'gpt-5.1-codex-mini' },
  { value: 'gpt-5.1-codex-max', label: 'gpt-5.1-codex-max' },
  { value: 'gpt-5.2', label: 'gpt-5.2' },
  { value: 'gpt-5.2-codex', label: 'gpt-5.2-codex' },
  { value: MODEL_CUSTOM_VALUE, label: 'Custom model...' }
];
const MODEL_EFFORTS = {
  'gpt-5.1-codex-mini': ['low', 'medium', 'high'],
  'gpt-5.1-codex-max': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.2': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.2-codex': ['low', 'medium', 'high', 'xhigh']
};
const EFFORT_LABELS = {
  none: 'none (disable reasoning)',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh'
};
const emptyTaskForm = {
  envId: '',
  ref: '',
  prompt: '',
  contextRepos: [],
  modelChoice: '',
  customModel: '',
  reasoningEffort: '',
  customReasoningEffort: '',
  useHostDockerSocket: false
};
const emptyResumeConfig = {
  modelChoice: '',
  customModel: '',
  reasoningEffort: '',
  customReasoningEffort: ''
};
const emptyAccountForm = {
  label: '',
  authJson: ''
};
const MAX_TASK_IMAGES = 5;
const emptyContextRepo = { envId: '', ref: '' };

const STATUS_CONFIG = {
  running: {
    label: 'Running',
    icon: PlayCircleOutlineIcon,
    fg: '#9a3412',
    bg: '#ffedd5',
    border: '#fdba74'
  },
  stopping: {
    label: 'Stopping',
    icon: HourglassTopIcon,
    fg: '#854d0e',
    bg: '#fef9c3',
    border: '#fde047'
  },
  completed: {
    label: 'Completed',
    icon: CheckCircleOutlineIcon,
    fg: '#166534',
    bg: '#dcfce7',
    border: '#86efac'
  },
  failed: {
    label: 'Failed',
    icon: ErrorOutlineIcon,
    fg: '#b91c1c',
    bg: '#fee2e2',
    border: '#fca5a5'
  },
  stopped: {
    label: 'Stopped',
    icon: PauseCircleOutlineIcon,
    fg: '#374151',
    bg: '#e5e7eb',
    border: '#d1d5db'
  },
  unknown: {
    label: 'Unknown',
    icon: HelpOutlineIcon,
    fg: '#475569',
    bg: '#e2e8f0',
    border: '#cbd5f5'
  }
};

function formatTimestamp(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatEpochSeconds(value) {
  if (!Number.isFinite(value)) return 'unknown';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString();
}

function formatDurationFromMinutes(value) {
  if (!Number.isFinite(value)) return 'unknown';
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
  if (!Number.isFinite(value)) return 'unknown';
  const diffMinutes = Math.round((value * 1000 - Date.now()) / 60000);
  if (diffMinutes === 0) return 'now';
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
  if (!Number.isFinite(value)) return 'unknown';
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded.toFixed(1);
  const cleaned = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
  return `${cleaned}%`;
}

function getEffortOptionsForModel(model) {
  return MODEL_EFFORTS[model] || [];
}

function resolveModelValue(modelChoice, customModel) {
  if (modelChoice === MODEL_CUSTOM_VALUE) {
    return customModel.trim();
  }
  return modelChoice;
}

function resolveReasoningEffortValue({ modelChoice, reasoningEffort, customReasoningEffort }) {
  if (!modelChoice) return '';
  if (modelChoice === MODEL_CUSTOM_VALUE) {
    return customReasoningEffort.trim();
  }
  return reasoningEffort;
}

function formatModelDisplay(value) {
  return value ? value : 'default';
}

function formatEffortDisplay(value) {
  return value ? value : 'default';
}

function formatRepoDisplay(repoUrl) {
  if (!repoUrl) return '';
  const trimmed = repoUrl.trim();
  if (!trimmed) return '';
  const cleaned = trimmed.replace(/\.git$/i, '');
  const pickFromPath = (path) => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return parts[0] || '';
  };
  if (cleaned.includes('://')) {
    try {
      const url = new URL(cleaned);
      const display = pickFromPath(url.pathname);
      return display || url.hostname;
    } catch (err) {
      return cleaned;
    }
  }
  const sshMatch = cleaned.match(/^[^@]+@[^:]+:(.+)$/);
  if (sshMatch) {
    const display = pickFromPath(sshMatch[1]);
    return display || cleaned;
  }
  const display = pickFromPath(cleaned);
  return display || cleaned;
}

function formatAccountLabel(account) {
  if (!account) return 'unknown';
  return account.label || account.id || 'unknown';
}

function normalizeAccountState(value) {
  if (!value || typeof value !== 'object') {
    return { accounts: [], activeAccountId: null };
  }
  if (!Array.isArray(value.accounts)) {
    return { accounts: [], activeAccountId: null };
  }
  return value;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
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

function isSupportedTaskImage(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  const allowedTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp'
  ]);
  const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
  return allowedTypes.has(type) || allowedExts.has(ext);
}

function getElapsedMs(startedAt, finishedAt, now) {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  const end = finishedAt ? Date.parse(finishedAt) : now;
  if (Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

function getLatestRun(task) {
  if (!task?.runs || task.runs.length === 0) return null;
  return task.runs[task.runs.length - 1];
}

function StatusIcon({ status, size = 'small' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = config.icon;
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

function formatLogEntry(entry) {
  if (!entry) return '';
  if (entry.parsed) {
    try {
      return JSON.stringify(entry.parsed, null, 2);
    } catch (error) {
      return entry.raw || '';
    }
  }
  return entry.raw || '';
}

function formatLogSummary(entry) {
  if (!entry) return '';
  const summary = entry.type || '';
  if (
    (entry.type === 'item.started' || entry.type === 'item.completed') &&
    entry.parsed?.item?.type
  ) {
    return `${summary} • ${entry.parsed.item.type}`;
  }
  return summary;
}

function formatBytes(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown size';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** order;
  return `${scaled.toFixed(order === 0 ? 0 : 1)} ${units[order]}`;
}

function getGitStatusDisplay(gitStatus) {
  if (!gitStatus) return null;
  const dirtyNote =
    gitStatus.dirty === true ? 'Uncommitted changes in worktree.' : 'Working tree clean.';
  if (gitStatus.hasChanges === false) {
    return {
      label: 'No changes',
      icon: <CheckCircleOutlineIcon fontSize="small" />,
      color: 'success',
      tooltip: `No changes since base commit. ${dirtyNote}`
    };
  }
  if (gitStatus.pushed === true) {
    return {
      label: 'Changes pushed',
      icon: <CloudDoneOutlinedIcon fontSize="small" />,
      color: 'success',
      tooltip: `Remote branch matches HEAD. ${dirtyNote}`
    };
  }
  if (gitStatus.pushed === false) {
    return {
      label: 'Unpushed changes',
      icon: <CloudUploadOutlinedIcon fontSize="small" />,
      color: 'warning',
      tooltip: `Local commits not on origin. ${dirtyNote}`
    };
  }
  return {
    label: 'Git status unknown',
    icon: <HelpOutlineIcon fontSize="small" />,
    color: 'default',
    tooltip: 'Unable to read git status.'
  };
}

function encodeArtifactPath(value) {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isImageArtifact(value) {
  const lower = value.toLowerCase();
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.bmp')
  );
}

function collectAgentMessages(entries) {
  if (!entries || entries.length === 0) return '';
  return entries
    .filter(
      (entry) =>
        entry.parsed?.type === 'item.completed' &&
        entry.parsed?.item?.type === 'agent_message' &&
        entry.parsed?.item?.text
    )
    .map((entry) => entry.parsed.item.text)
    .join('\n');
}

function App() {
  const [envs, setEnvs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [accountState, setAccountState] = useState({ accounts: [], activeAccountId: null });
  const [selectedEnvId, setSelectedEnvId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskFilterEnvId, setTaskFilterEnvId] = useState('');
  const [envForm, setEnvForm] = useState(emptyEnvForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [resumePrompt, setResumePrompt] = useState('');
  const [resumeConfig, setResumeConfig] = useState(emptyResumeConfig);
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskDiff, setTaskDiff] = useState(null);
  const [revealedDiffs, setRevealedDiffs] = useState({});
  const [resumeUseHostDockerSocket, setResumeUseHostDockerSocket] = useState(false);
  const [resumeDockerTouched, setResumeDockerTouched] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUpdating, setImageUpdating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskImages, setTaskImages] = useState([]);
  const [taskImageError, setTaskImageError] = useState('');
  const [taskImageUploading, setTaskImageUploading] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [rateLimits, setRateLimits] = useState(null);
  const [rateLimitsLoading, setRateLimitsLoading] = useState(false);
  const [rateLimitsError, setRateLimitsError] = useState('');
  const [rateLimitsFetchedAt, setRateLimitsFetchedAt] = useState('');
  const [activeTab, setActiveTab] = useState(1);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const taskImageInputRef = useRef(null);
  const logStreamRef = useRef(null);
  const resumeDefaultsTaskIdRef = useRef('');

  const revealDiff = (path) => {
    setRevealedDiffs((prev) => ({ ...prev, [path]: true }));
  };

  const selectedEnv = useMemo(
    () => envs.find((env) => env.envId === selectedEnvId),
    [envs, selectedEnvId]
  );
  const activeAccount = useMemo(
    () => accountState.accounts.find((account) => account.isActive),
    [accountState]
  );

  const visibleTasks = useMemo(() => {
    const filtered = taskFilterEnvId
      ? tasks.filter((task) => task.envId === taskFilterEnvId)
      : tasks;
    return filtered
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [tasks, taskFilterEnvId]);
  const hasActiveRuns = useMemo(() => {
    const taskRunning = tasks.some(
      (task) => task.status === 'running' || task.status === 'stopping'
    );
    const detailRunning =
      taskDetail?.status === 'running' || taskDetail?.status === 'stopping';
    const runRunning = (taskDetail?.runs || []).some(
      (run) => run.status === 'running' || run.status === 'stopping'
    );
    return taskRunning || detailRunning || runRunning;
  }, [tasks, taskDetail]);

  const gitStatusDisplay = useMemo(
    () => getGitStatusDisplay(taskDetail?.gitStatus),
    [taskDetail?.gitStatus]
  );
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const running = tasks.filter(
      (task) => task.status === 'running' || task.status === 'stopping'
    ).length;
    const failed = tasks.filter((task) => task.status === 'failed').length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    return { total, running, failed, completed };
  }, [tasks]);
  const usedContextEnvIds = useMemo(
    () => taskForm.contextRepos.map((entry) => entry.envId).filter(Boolean),
    [taskForm.contextRepos]
  );
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
    const resetsDisplay =
      resetsRelative === 'unknown' ? resetsAt : `${resetsAt} (${resetsRelative})`;
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
  const creditsSummary = useMemo(() => {
    const credits = rateLimits?.credits;
    if (!credits) return 'No credit data.';
    if (!credits.hasCredits) return 'No credits available.';
    if (credits.unlimited) return 'Unlimited credits.';
    if (credits.balance) return `Balance: ${credits.balance}`;
    return 'Credits available.';
  }, [rateLimits]);

  async function refreshAll() {
    const [envData, taskData, accountData] = await Promise.all([
      apiRequest('/api/envs'),
      apiRequest('/api/tasks'),
      apiRequest('/api/accounts')
    ]);
    setEnvs(envData);
    setTasks(taskData);
    setAccountState(normalizeAccountState(accountData));
    if (!selectedEnvId && envData.length > 0) {
      setSelectedEnvId(envData[0].envId);
    }
  }

  async function refreshTaskDetail(taskId) {
    if (!taskId) return;
    try {
      const detail = await apiRequest(`/api/tasks/${taskId}`);
      let diff = null;
      try {
        diff = await apiRequest(`/api/tasks/${taskId}/diff`);
      } catch (diffError) {
        if (diffError.status !== 404) {
          throw diffError;
        }
      }
      setTaskDetail(detail);
      setTaskDiff(diff);
    } catch (err) {
      if (err.status === 404) {
        setSelectedTaskId('');
        setTaskDetail(null);
        setTaskDiff(null);
        return;
      }
      throw err;
    }
  }

  async function refreshImageInfo() {
    setImageLoading(true);
    try {
      const info = await apiRequest('/api/settings/image');
      setImageInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setImageLoading(false);
    }
  }

  async function refreshAccounts() {
    const accountData = await apiRequest('/api/accounts');
    setAccountState(normalizeAccountState(accountData));
  }

  async function refreshRateLimits() {
    setRateLimitsError('');
    setRateLimitsLoading(true);
    try {
      const info = await apiRequest('/api/accounts/rate-limits');
      setRateLimits(info.rateLimits || null);
      setRateLimitsFetchedAt(info.fetchedAt || '');
    } catch (err) {
      setRateLimits(null);
      setRateLimitsFetchedAt('');
      setRateLimitsError(err.message);
    } finally {
      setRateLimitsLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll().catch(() => {});
      if (selectedTaskId) {
        refreshTaskDetail(selectedTaskId).catch(() => {});
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedTaskId]);

  useEffect(() => {
    if (activeTab !== 2) return;
    refreshRateLimits().catch(() => {});
  }, [activeTab, activeAccount?.id]);

  useEffect(() => {
    if (activeTab !== 3) return;
    refreshImageInfo().catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (!selectedTaskId) {
      resumeDefaultsTaskIdRef.current = '';
      setResumeUseHostDockerSocket(false);
      setResumeDockerTouched(false);
      return;
    }
    if (resumeDefaultsTaskIdRef.current === selectedTaskId) return;
    const selectedTask = tasks.find((task) => task.taskId === selectedTaskId);
    if (!selectedTask) return;
    resumeDefaultsTaskIdRef.current = selectedTaskId;
    setResumeUseHostDockerSocket(selectedTask.useHostDockerSocket === true);
    setResumeDockerTouched(false);
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (!taskDetail || resumeDockerTouched) return;
    if (resumeDefaultsTaskIdRef.current !== taskDetail.taskId) return;
    setResumeUseHostDockerSocket(taskDetail.useHostDockerSocket === true);
  }, [taskDetail, resumeDockerTouched]);

  useEffect(() => {
    if (!selectedTaskId || activeTab !== 1) {
      setShowScrollTop(false);
      return;
    }
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 240);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [selectedTaskId, activeTab]);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null);
      setTaskDiff(null);
      setRevealedDiffs({});
      setResumeConfig(emptyResumeConfig);
      return;
    }
    refreshTaskDetail(selectedTaskId).catch((err) => setError(err.message));
  }, [selectedTaskId]);

  useEffect(() => {
    if (selectedTaskId) {
      setShowTaskForm(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    if (!hasActiveRuns) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasActiveRuns]);

  useEffect(() => {
    if (!selectedTaskId || !taskDetail) return;
    if (taskDetail.status !== 'running' && taskDetail.status !== 'stopping') {
      if (logStreamRef.current) {
        logStreamRef.current.close();
        logStreamRef.current = null;
      }
      return;
    }
    const latestRun = taskDetail.runs?.[taskDetail.runs.length - 1];
    if (!latestRun) return;
    if (logStreamRef.current) {
      logStreamRef.current.close();
    }
    const eventSource = new EventSource(
      apiUrl(`/api/tasks/${selectedTaskId}/logs/stream?runId=${latestRun.runId}`)
    );
    logStreamRef.current = eventSource;
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { runId, entry } = payload;
        if (!runId || !entry) return;
        setTaskDetail((prev) => {
          if (!prev) return prev;
          const runLogs = prev.runLogs ? [...prev.runLogs] : [];
          const runIndex = runLogs.findIndex((run) => run.runId === runId);
          if (runIndex === -1) return prev;
          const run = runLogs[runIndex];
          const existing = run.entries || [];
          if (existing.some((item) => item.id === entry.id)) {
            return prev;
          }
          const updatedRun = {
            ...run,
            entries: [...existing, entry]
          };
          runLogs[runIndex] = updatedRun;
          return { ...prev, runLogs };
        });
      } catch (err) {
        // Ignore malformed stream payloads.
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => {
      eventSource.close();
      if (logStreamRef.current === eventSource) {
        logStreamRef.current = null;
      }
    };
  }, [selectedTaskId, taskDetail]);

  async function handleCreateEnv() {
    setError('');
    setLoading(true);
    try {
      await apiRequest('/api/envs', {
        method: 'POST',
        body: JSON.stringify(envForm)
      });
      setEnvForm(emptyEnvForm);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleTaskModelChoiceChange(value) {
    setTaskForm((prev) => {
      const next = { ...prev, modelChoice: value };
      if (!value) {
        next.reasoningEffort = '';
        return next;
      }
      if (value !== MODEL_CUSTOM_VALUE) {
        const supportedEfforts = getEffortOptionsForModel(value);
        if (next.reasoningEffort && !supportedEfforts.includes(next.reasoningEffort)) {
          next.reasoningEffort = '';
        }
      }
      return next;
    });
  }

  function handleResumeModelChoiceChange(value) {
    setResumeConfig((prev) => {
      const next = { ...prev, modelChoice: value };
      if (!value) {
        next.reasoningEffort = '';
        return next;
      }
      if (value !== MODEL_CUSTOM_VALUE) {
        const supportedEfforts = getEffortOptionsForModel(value);
        if (next.reasoningEffort && !supportedEfforts.includes(next.reasoningEffort)) {
          next.reasoningEffort = '';
        }
      }
      return next;
    });
  }

  function handleAddContextRepo() {
    setTaskForm((prev) => ({
      ...prev,
      contextRepos: [...prev.contextRepos, { ...emptyContextRepo }]
    }));
  }

  function handleRemoveContextRepo(index) {
    setTaskForm((prev) => ({
      ...prev,
      contextRepos: prev.contextRepos.filter((_, idx) => idx !== index)
    }));
  }

  function handleContextRepoChange(index, field, value) {
    setTaskForm((prev) => {
      const next = [...prev.contextRepos];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, contextRepos: next };
    });
  }

  async function handleCreateTask() {
    setError('');
    setTaskImageError('');
    setLoading(true);
    try {
      let imagePaths = [];
      if (taskImages.length > 0) {
        setTaskImageUploading(true);
        try {
          const formData = new FormData();
          taskImages.forEach((file) => {
            formData.append('images', file);
          });
          const response = await fetch(apiUrl('/api/uploads'), {
            method: 'POST',
            body: formData
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Image upload failed.');
          }
          const uploadPayload = await response.json();
          imagePaths = (uploadPayload.uploads || []).map((upload) => upload.path);
        } finally {
          setTaskImageUploading(false);
        }
      }
      const modelValue = resolveModelValue(taskForm.modelChoice, taskForm.customModel);
      const reasoningEffortValue = resolveReasoningEffortValue(taskForm);
      const contextRepos = (taskForm.contextRepos || [])
        .map((entry) => ({
          envId: (entry.envId || '').trim(),
          ref: (entry.ref || '').trim()
        }))
        .filter((entry) => entry.envId)
        .map((entry) => (entry.ref ? entry : { envId: entry.envId }));
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          envId: taskForm.envId,
          ref: taskForm.ref,
          prompt: taskForm.prompt,
          imagePaths,
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: taskForm.useHostDockerSocket,
          contextRepos: contextRepos.length > 0 ? contextRepos : undefined
        })
      });
      setTaskForm(emptyTaskForm);
      setTaskImages([]);
      if (taskImageInputRef.current) {
        taskImageInputRef.current.value = '';
      }
      setShowTaskForm(false);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleTaskImagesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const nextImages = [];
    const errors = [];
    for (const file of files) {
      if (!isSupportedTaskImage(file)) {
        errors.push(`Unsupported image: ${file.name}`);
        continue;
      }
      nextImages.push(file);
    }
    const combined = [...taskImages, ...nextImages];
    if (combined.length > MAX_TASK_IMAGES) {
      errors.push(`Only ${MAX_TASK_IMAGES} images can be attached.`);
    }
    setTaskImages(combined.slice(0, MAX_TASK_IMAGES));
    setTaskImageError(errors.join(' '));
    event.target.value = '';
  }

  function handleRemoveTaskImage(index) {
    setTaskImages((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleClearTaskImages() {
    setTaskImages([]);
    setTaskImageError('');
    if (taskImageInputRef.current) {
      taskImageInputRef.current.value = '';
    }
  }

  async function handleResumeTask() {
    if (!selectedTaskId || !resumePrompt.trim()) return;
    setError('');
    setLoading(true);
    try {
      const modelValue = resolveModelValue(resumeConfig.modelChoice, resumeConfig.customModel);
      const reasoningEffortValue = resolveReasoningEffortValue(resumeConfig);
      await apiRequest(`/api/tasks/${selectedTaskId}/resume`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: resumePrompt,
          model: modelValue || undefined,
          reasoningEffort: reasoningEffortValue || undefined,
          useHostDockerSocket: resumeUseHostDockerSocket
        })
      });
      setResumePrompt('');
      setResumeConfig(emptyResumeConfig);
      setResumeDockerTouched(false);
      await refreshAll();
      await refreshTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTask(taskId) {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (taskId === selectedTaskId) {
        setSelectedTaskId('');
        setTaskDetail(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEnv(envId) {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/envs/${envId}`, { method: 'DELETE' });
      if (envId === selectedEnvId) {
        setSelectedEnvId('');
      }
      const selectedTask = tasks.find((task) => task.taskId === selectedTaskId);
      if (selectedTask && selectedTask.envId === envId) {
        setSelectedTaskId('');
        setTaskDetail(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePullImage() {
    setError('');
    setImageUpdating(true);
    try {
      const info = await apiRequest('/api/settings/image/pull', { method: 'POST' });
      setImageInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setImageUpdating(false);
    }
  }

  async function handleAddAccount() {
    if (!accountForm.authJson.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          label: accountForm.label,
          authJson: accountForm.authJson
        })
      });
      setAccountForm(emptyAccountForm);
      setShowAccountForm(false);
      await refreshAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateAccount(accountId) {
    setError('');
    setLoading(true);
    try {
      const accountData = await apiRequest(`/api/accounts/${accountId}/activate`, {
        method: 'POST'
      });
      setAccountState(normalizeAccountState(accountData));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRotateAccount() {
    setError('');
    setLoading(true);
    try {
      const accountData = await apiRequest('/api/accounts/rotate', { method: 'POST' });
      setAccountState(normalizeAccountState(accountData));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount(accountId) {
    setError('');
    setLoading(true);
    try {
      const accountData = await apiRequest(`/api/accounts/${accountId}`, { method: 'DELETE' });
      setAccountState(normalizeAccountState(accountData));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePushTask() {
    if (!selectedTaskId) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${selectedTaskId}/push`, { method: 'POST' });
      await refreshTaskDetail(selectedTaskId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStopTask(taskId = selectedTaskId) {
    if (!taskId) return;
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/stop`, { method: 'POST' });
      if (taskId === selectedTaskId) {
        await refreshTaskDetail(taskId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBackToTasks() {
    setSelectedTaskId('');
    setTaskDetail(null);
  }

  return (
    <Box className="app-shell">
      <Tabs
        value={activeTab}
        onChange={(event, value) => setActiveTab(value)}
        textColor="primary"
        indicatorColor="primary"
        aria-label="Orchestrator sections"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          alignSelf: 'flex-start',
          maxWidth: '100%',
          '.MuiTabs-flexContainer': {
            gap: 1
          },
          '.MuiTab-root': {
            minWidth: 'auto'
          }
        }}
      >
        <Tab icon={<FolderOpenOutlinedIcon />} iconPosition="start" label="Environments" />
        <Tab
          icon={<ListAltOutlinedIcon />}
          iconPosition="start"
          label="Tasks"
          onClick={() => {
            if (activeTab === 1 && selectedTaskId) {
              handleBackToTasks();
            }
          }}
        />
        <Tab icon={<AccountCircleOutlinedIcon />} iconPosition="start" label="Accounts" />
        <Tab icon={<SettingsOutlinedIcon />} iconPosition="start" label="Settings" />
      </Tabs>

      {activeTab === 0 && (
        <Box className="section-shell fade-in">
          <Card className="panel-card">
            <CardContent>
              <Stack spacing={3}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FolderOpenOutlinedIcon color="primary" />
                      <Typography variant="h6" className="panel-title">
                        Environments
                      </Typography>
                    </Stack>
                    <Typography color="text.secondary">
                      Create and manage repo sources for Codex runs.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label={`${envs.length} environments`} size="small" />
                      <Chip
                        label={`Selected: ${
                          selectedEnv ? formatRepoDisplay(selectedEnv.repoUrl) : 'none'
                        }`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                  <Button variant="outlined" size="small" onClick={refreshAll} disabled={loading}>
                    Sync now
                  </Button>
                </Stack>
                <Divider />
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FolderOpenOutlinedIcon color="primary" />
                    <Typography variant="h6" className="panel-title">
                      Create environment
                    </Typography>
                  </Stack>
                  <TextField
                    label="Repository URL"
                    fullWidth
                    value={envForm.repoUrl}
                    onChange={(event) =>
                      setEnvForm((prev) => ({ ...prev, repoUrl: event.target.value }))
                    }
                  />
                  <TextField
                    label="Default branch"
                    fullWidth
                    value={envForm.defaultBranch}
                    onChange={(event) =>
                      setEnvForm((prev) => ({ ...prev, defaultBranch: event.target.value }))
                    }
                  />
                  <Button
                    variant="contained"
                    onClick={handleCreateEnv}
                    disabled={loading || !envForm.repoUrl.trim()}
                  >
                    Create environment
                  </Button>
                </Stack>
                <Divider />
                <Stack spacing={2}>
                  <Typography variant="h6" className="panel-title">
                    Environments
                  </Typography>
                  <Stack spacing={1.5}>
                    {envs.map((env) => (
                      <Card
                        key={env.envId}
                        className="task-card"
                        sx={{
                          borderColor: env.envId === selectedEnvId ? 'primary.main' : 'divider',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedEnvId(env.envId)}
                      >
                        <CardContent>
                          <Stack spacing={0.5}>
                            <Tooltip title={env.repoUrl || ''}>
                              <Typography fontWeight={600}>
                                {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                              </Typography>
                            </Tooltip>
                            <Typography color="text.secondary" className="mono">
                              {env.envId}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={`default: ${env.defaultBranch}`} />
                              <Button
                                size="small"
                                color="secondary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteEnv(env.envId);
                                }}
                              >
                                Remove
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                    {envs.length === 0 && (
                      <Typography color="text.secondary">
                        No environments yet. Create one to get started.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}

      {activeTab === 1 && (
        <Box className="section-shell fade-in">
          <Card className="panel-card">
            <CardContent>
              <Stack spacing={3}>
                {!selectedTaskId && (
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <BoltOutlinedIcon color="primary" />
                          <Typography variant="h6" className="panel-title">
                            Tasks
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            component="span"
                            className={`status-dot ${hasActiveRuns ? '' : 'is-idle'}`}
                          />
                          <Typography variant="subtitle2">
                            {hasActiveRuns ? 'Runs in progress' : 'No active runs'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip label={`${taskStats.total} total`} size="small" />
                          <Chip label={`${taskStats.running} running`} size="small" />
                          <Chip label={`${taskStats.failed} failed`} size="small" />
                        </Stack>
                      </Stack>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={refreshAll}
                        disabled={loading}
                      >
                        Sync now
                      </Button>
                    </Stack>
                    <Divider />
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <TextField
                          select
                          size="small"
                          label="Filter"
                          value={taskFilterEnvId}
                          onChange={(event) => setTaskFilterEnvId(event.target.value)}
                          sx={{ minWidth: 220 }}
                        >
                          <MenuItem value="">All environments</MenuItem>
                          {envs.map((env) => (
                            <MenuItem key={env.envId} value={env.envId}>
                              {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                            </MenuItem>
                          ))}
                        </TextField>
                        <Button size="small" variant="outlined" onClick={refreshAll}>
                          Refresh
                        </Button>
                      </Stack>
                      <Button
                        size="small"
                        variant={showTaskForm ? 'outlined' : 'contained'}
                        onClick={() => setShowTaskForm((prev) => !prev)}
                      >
                        {showTaskForm ? 'Hide new task' : 'New task'}
                      </Button>
                    </Stack>
                    <Collapse in={showTaskForm} unmountOnExit>
                      <Stack spacing={2} sx={{ mt: 2 }}>
                        <Divider />
                        <Typography variant="subtitle2">New task</Typography>
                        <TextField
                          select
                          label="Environment"
                          value={taskForm.envId}
                          onChange={(event) =>
                            setTaskForm((prev) => ({ ...prev, envId: event.target.value }))
                          }
                          fullWidth
                        >
                          {envs.map((env) => (
                            <MenuItem key={env.envId} value={env.envId}>
                              {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Branch / tag / ref"
                          fullWidth
                          value={taskForm.ref}
                          onChange={(event) =>
                            setTaskForm((prev) => ({ ...prev, ref: event.target.value }))
                          }
                          placeholder={selectedEnv?.defaultBranch || 'main'}
                        />
                        <TextField
                          label="Task prompt"
                          fullWidth
                          multiline
                          minRows={3}
                          value={taskForm.prompt}
                          onChange={(event) =>
                            setTaskForm((prev) => ({ ...prev, prompt: event.target.value }))
                          }
                        />
                        <Divider />
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
                            onChange={(event) =>
                              setTaskForm((prev) => ({ ...prev, customModel: event.target.value }))
                            }
                          />
                        )}
                        {taskForm.modelChoice &&
                          taskForm.modelChoice !== MODEL_CUSTOM_VALUE && (
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
                        <Divider />
                        <Typography variant="subtitle2">Reference repos (read-only)</Typography>
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems="center"
                          >
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AddOutlinedIcon />}
                              onClick={handleAddContextRepo}
                              disabled={
                                loading ||
                                envs.length === 0 ||
                                usedContextEnvIds.length >= envs.length
                              }
                            >
                              Add reference repo
                            </Button>
                            <Typography color="text.secondary">
                              Attach existing environments as read-only context.
                            </Typography>
                          </Stack>
                          {taskForm.contextRepos.length === 0 && (
                            <Typography color="text.secondary">
                              No reference repos attached.
                            </Typography>
                          )}
                          {taskForm.contextRepos.map((entry, index) => {
                            const selectedContextEnv = envs.find((env) => env.envId === entry.envId);
                            return (
                              <Stack
                                key={`context-repo-${index}`}
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                alignItems="center"
                              >
                                <TextField
                                  select
                                  size="small"
                                  label="Environment"
                                  value={entry.envId}
                                  onChange={(event) =>
                                    handleContextRepoChange(index, 'envId', event.target.value)
                                  }
                                  sx={{ minWidth: 220, flex: 1 }}
                                >
                                  {envs.map((env) => (
                                    <MenuItem
                                      key={env.envId}
                                      value={env.envId}
                                      disabled={
                                        usedContextEnvIds.includes(env.envId) &&
                                        env.envId !== entry.envId
                                      }
                                    >
                                      {formatRepoDisplay(env.repoUrl) || env.repoUrl}
                                    </MenuItem>
                                  ))}
                                </TextField>
                                <TextField
                                  size="small"
                                  label="Branch / tag / ref"
                                  value={entry.ref}
                                  onChange={(event) =>
                                    handleContextRepoChange(index, 'ref', event.target.value)
                                  }
                                  placeholder={selectedContextEnv?.defaultBranch || 'main'}
                                  sx={{ flex: 1 }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveContextRepo(index)}
                                  aria-label="Remove reference repo"
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            );
                          })}
                        </Stack>
                        <Divider />
                        <Typography variant="subtitle2">Attachments</Typography>
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems="center"
                          >
                            <Button
                              variant="outlined"
                              component="label"
                              disabled={
                                loading ||
                                taskImageUploading ||
                                taskImages.length >= MAX_TASK_IMAGES
                              }
                            >
                              Add images
                              <input
                                ref={taskImageInputRef}
                                type="file"
                                hidden
                                multiple
                                accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                                onChange={handleTaskImagesSelected}
                              />
                            </Button>
                            <Typography color="text.secondary">
                              Up to {MAX_TASK_IMAGES} images, used only for the initial request.
                            </Typography>
                          </Stack>
                          {taskImageError && <Typography color="error">{taskImageError}</Typography>}
                          {taskImages.length > 0 && (
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {taskImages.map((file, index) => (
                                  <Chip
                                    key={`${file.name}-${index}`}
                                    label={`${file.name} (${formatBytes(file.size)})`}
                                    onDelete={() => handleRemoveTaskImage(index)}
                                  />
                                ))}
                              </Stack>
                              <Button
                                size="small"
                                color="secondary"
                                onClick={handleClearTaskImages}
                                disabled={loading || taskImageUploading}
                              >
                                Clear images
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                        <Button
                          variant="contained"
                          onClick={handleCreateTask}
                          disabled={
                            loading ||
                            taskImageUploading ||
                            !taskForm.envId ||
                            !taskForm.prompt.trim()
                          }
                        >
                          {taskImageUploading ? 'Uploading images...' : 'Run task'}
                        </Button>
                      </Stack>
                    </Collapse>
                    <Divider />
                    <Stack spacing={2}>
                      <Typography variant="h6" className="panel-title">
                        Tasks
                      </Typography>
                      <Stack spacing={1.5}>
                        {visibleTasks.map((task) => (
                          <Card
                            key={task.taskId}
                            className="task-card"
                            sx={{
                              borderColor:
                                task.taskId === selectedTaskId ? 'primary.main' : 'divider',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedTaskId(task.taskId)}
                          >
                            <CardContent>
                              <Stack spacing={1}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  justifyContent="space-between"
                                >
                                  <Typography fontWeight={600}>{task.branchName}</Typography>
                                  <StatusIcon status={task.status} />
                                </Stack>
                                <Tooltip title={task.repoUrl || ''}>
                                  <Typography color="text.secondary">
                                    {formatRepoDisplay(task.repoUrl) || task.repoUrl}
                                  </Typography>
                                </Tooltip>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  flexWrap="wrap"
                                  alignItems="center"
                                >
                                  <Chip size="small" label={task.ref} />
                                  {(task.model || task.reasoningEffort) && (
                                    <Chip
                                      size="small"
                                      label={`model: ${formatModelDisplay(task.model)}`}
                                    />
                                  )}
                                  {(task.model || task.reasoningEffort) && (
                                    <Chip
                                      size="small"
                                      label={`effort: ${formatEffortDisplay(task.reasoningEffort)}`}
                                    />
                                  )}
                                  <Chip
                                    size="small"
                                    label={`created ${formatTimestamp(task.createdAt)}`}
                                  />
                                  {(task.status === 'running' || task.status === 'stopping') &&
                                    (() => {
                                      const latestRun = getLatestRun(task);
                                      const durationMs = getElapsedMs(
                                        latestRun?.startedAt || task.createdAt,
                                        null,
                                        now
                                      );
                                      if (durationMs === null) return null;
                                      const statusLabel =
                                        STATUS_CONFIG[task.status]?.label.toLowerCase() ||
                                        'running';
                                      return (
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          icon={<AccessTimeIcon fontSize="small" />}
                                          label={`${statusLabel} ${formatDuration(durationMs)}`}
                                        />
                                      );
                                    })()}
                                </Stack>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Tooltip title="Stop task">
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleStopTask(task.taskId);
                                        }}
                                        disabled={loading || task.status !== 'running'}
                                        aria-label={`Stop task ${task.taskId}`}
                                      >
                                        <StopCircleOutlinedIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Remove task">
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="secondary"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDeleteTask(task.taskId);
                                        }}
                                        disabled={loading}
                                        aria-label={`Remove task ${task.taskId}`}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                        {visibleTasks.length === 0 && (
                          <Typography color="text.secondary">
                            No tasks yet. Create one to get started.
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                )}
                {selectedTaskId && (
                  <Stack spacing={2}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Back to tasks">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={handleBackToTasks}
                            aria-label="Back to tasks"
                          >
                            <ArrowBackOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                        <Typography variant="h6" className="panel-title">
                          Task details
                        </Typography>
                      </Stack>
                      <Button size="small" variant="outlined" onClick={refreshAll}>
                        Refresh
                      </Button>
                    </Stack>
                    {selectedTaskId && !taskDetail && (
                      <Typography color="text.secondary">Loading task details...</Typography>
                    )}
                    {taskDetail && (
                      <Stack spacing={2}>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={600}>{taskDetail.branchName}</Typography>
                          <Tooltip title={taskDetail.repoUrl || ''}>
                            <Typography color="text.secondary">
                              {formatRepoDisplay(taskDetail.repoUrl) || taskDetail.repoUrl}
                            </Typography>
                          </Tooltip>
                          <Typography className="mono">{taskDetail.taskId}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                          <StatusIcon status={taskDetail.status} />
                          <Chip label={`ref: ${taskDetail.ref}`} size="small" />
                          <Chip
                            label={`model: ${formatModelDisplay(taskDetail.model)}`}
                            size="small"
                          />
                          <Chip
                            label={`effort: ${formatEffortDisplay(taskDetail.reasoningEffort)}`}
                            size="small"
                          />
                          <Chip label={`thread: ${taskDetail.threadId || 'pending'}`} size="small" />
                          {(taskDetail.status === 'running' || taskDetail.status === 'stopping') &&
                            (() => {
                              const latestRun = getLatestRun(taskDetail);
                              const durationMs = getElapsedMs(
                                latestRun?.startedAt || taskDetail.createdAt,
                                null,
                                now
                              );
                              if (durationMs === null) return null;
                              const statusLabel =
                                STATUS_CONFIG[taskDetail.status]?.label.toLowerCase() || 'running';
                              return (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  icon={<AccessTimeIcon fontSize="small" />}
                                  label={`${statusLabel} ${formatDuration(durationMs)}`}
                                />
                              );
                            })()}
                          {gitStatusDisplay && (
                            <Tooltip title={gitStatusDisplay.tooltip}>
                              <Chip
                                icon={gitStatusDisplay.icon}
                                label={gitStatusDisplay.label}
                                size="small"
                                color={gitStatusDisplay.color}
                                variant="outlined"
                              />
                            </Tooltip>
                          )}
                        </Stack>
                        {taskDetail.contextRepos?.length > 0 && (
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Reference repos (read-only)</Typography>
                            <Stack spacing={1}>
                              {taskDetail.contextRepos.map((repo, index) => (
                                <Stack
                                  key={`${repo.envId || repo.repoUrl || 'repo'}-${index}`}
                                  direction={{ xs: 'column', sm: 'row' }}
                                  spacing={1}
                                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                                  sx={{ flexWrap: 'wrap' }}
                                >
                                  <Typography color="text.secondary">
                                    {formatRepoDisplay(repo.repoUrl) || repo.repoUrl || repo.envId}
                                  </Typography>
                                  <Chip
                                    size="small"
                                    label={`ref: ${repo.ref || 'default'}`}
                                  />
                                  {repo.worktreePath && (
                                    <Typography className="mono" color="text.secondary">
                                      {repo.worktreePath}
                                    </Typography>
                                  )}
                                </Stack>
                              ))}
                            </Stack>
                          </Stack>
                        )}
                        <Stack spacing={2}>
                          <Box component="details" className="log-entry">
                            <summary className="log-summary">
                              <span>Diff</span>
                              <span className="log-meta">
                                {taskDiff
                                  ? taskDiff.available
                                    ? `${taskDiff.files.length} files`
                                    : 'Unavailable'
                                  : 'Loading'}
                              </span>
                            </summary>
                            <Stack spacing={1} sx={{ mt: 1 }}>
                              {!taskDiff && (
                                <Typography color="text.secondary">Loading diff...</Typography>
                              )}
                              {taskDiff && !taskDiff.available && (
                                <Typography color="text.secondary">
                                  {`Diff unavailable: ${taskDiff.reason || 'unknown error'}`}
                                </Typography>
                              )}
                              {taskDiff && taskDiff.available && taskDiff.baseSha && (
                                <Typography className="mono" color="text.secondary">
                                  {`Base commit: ${taskDiff.baseSha}`}
                                </Typography>
                              )}
                              {taskDiff && taskDiff.available && taskDiff.files.length === 0 && (
                                <Typography color="text.secondary">No changes yet.</Typography>
                              )}
                              {taskDiff && taskDiff.available && taskDiff.files.length > 0 && (
                                <Stack spacing={1}>
                                  {taskDiff.files.map((file) => (
                                    <Box key={file.path} component="details" className="diff-file">
                                      <summary className="log-summary">
                                        <span className="mono">{file.path}</span>
                                        <span className="log-meta">{`${file.lineCount} lines`}</span>
                                      </summary>
                                      <Box sx={{ mt: 1 }}>
                                        {file.tooLarge && !revealedDiffs[file.path] ? (
                                          <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography color="text.secondary">
                                              {`Large diff (${file.lineCount} lines).`}
                                            </Typography>
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              onClick={() => revealDiff(file.path)}
                                            >
                                              Show diff
                                            </Button>
                                          </Stack>
                                        ) : (
                                          <Box className="log-box diff-box">
                                            <pre>{file.diff}</pre>
                                          </Box>
                                        )}
                                      </Box>
                                    </Box>
                                  ))}
                                </Stack>
                              )}
                            </Stack>
                          </Box>
                          <Typography variant="subtitle2">Runs</Typography>
                          <Stack spacing={1}>
                            {(taskDetail.runLogs || []).map((run) => {
                              const entries = run.entries || [];
                              const agentMessages = collectAgentMessages(entries);
                              const artifacts = run.artifacts || [];
                              return (
                                <React.Fragment key={run.runId}>
                                  <Box component="details" className="log-entry" open>
                                    <summary className="log-summary">
                                      <span>Request</span>
                                      <span className="log-meta">{run.runId}</span>
                                    </summary>
                                    {(run.model || run.reasoningEffort) && (
                                      <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        sx={{ mt: 1 }}
                                      >
                                        <Chip
                                          size="small"
                                          label={`model: ${formatModelDisplay(run.model)}`}
                                        />
                                        <Chip
                                          size="small"
                                          label={`effort: ${formatEffortDisplay(
                                            run.reasoningEffort
                                          )}`}
                                        />
                                      </Stack>
                                    )}
                                    <Box className="log-box">
                                      <pre>{run.prompt || 'unknown'}</pre>
                                    </Box>
                                  </Box>
                                  <Box component="details" className="log-run">
                                    <summary className="log-summary">
                                      <span>{run.runId}</span>
                                      <Box
                                        component="span"
                                        className="log-meta"
                                        sx={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 1
                                        }}
                                      >
                                        <StatusIcon status={run.status} size="small" />
                                        <span>{formatTimestamp(run.startedAt)}</span>
                                        {(() => {
                                          const durationMs = getElapsedMs(
                                            run.startedAt,
                                            run.finishedAt,
                                            now
                                          );
                                          if (durationMs === null) return null;
                                          return <span>{formatDuration(durationMs)}</span>;
                                        })()}
                                      </Box>
                                    </summary>
                                    <Stack spacing={1} sx={{ mt: 1 }}>
                                      {entries.length === 0 && (
                                        <Typography color="text.secondary">No logs yet.</Typography>
                                      )}
                                      {entries.map((entry) => (
                                        <Box
                                          key={`${run.runId}-${entry.id}`}
                                          component="details"
                                          className="log-entry"
                                        >
                                          <summary className="log-summary">
                                            <span className="mono">
                                              {formatLogSummary(entry)}
                                            </span>
                                          </summary>
                                          <Box className="log-box">
                                            <pre>{formatLogEntry(entry)}</pre>
                                          </Box>
                                        </Box>
                                      ))}
                                    </Stack>
                                  </Box>
                                  <Box component="details" className="log-entry">
                                    <summary className="log-summary">
                                      <span>Artifacts</span>
                                      <span className="log-meta">{artifacts.length}</span>
                                    </summary>
                                    <Box sx={{ mt: 1 }}>
                                      {artifacts.length === 0 && (
                                        <Typography color="text.secondary">
                                          No artifacts for this run.
                                        </Typography>
                                      )}
                                      {artifacts.length > 0 &&
                                        (() => {
                                          const imageArtifacts = artifacts.filter((artifact) =>
                                            isImageArtifact(artifact.path)
                                          );
                                          const fileArtifacts = artifacts.filter(
                                            (artifact) => !isImageArtifact(artifact.path)
                                          );
                                          const renderArtifactCard = (artifact, showImage) => {
                                            const encodedPath = encodeArtifactPath(artifact.path);
                                            const artifactUrl = apiUrl(
                                              `/api/tasks/${taskDetail.taskId}/artifacts/${run.runId}/${encodedPath}`
                                            );
                                            return (
                                              <Box key={artifact.path} className="artifact-item">
                                                {showImage && (
                                                  <img
                                                    className="artifact-image"
                                                    src={artifactUrl}
                                                    alt={artifact.path}
                                                  />
                                                )}
                                                <Stack spacing={1}>
                                                  <Typography className="mono">
                                                    {artifact.path}
                                                  </Typography>
                                                  <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    alignItems="center"
                                                    justifyContent="space-between"
                                                  >
                                                    <Typography
                                                      color="text.secondary"
                                                      variant="caption"
                                                    >
                                                      {formatBytes(artifact.size)}
                                                    </Typography>
                                                    <Button
                                                      component="a"
                                                      href={artifactUrl}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      size="small"
                                                      variant="outlined"
                                                    >
                                                      Open
                                                    </Button>
                                                  </Stack>
                                                </Stack>
                                              </Box>
                                            );
                                          };
                                          if (imageArtifacts.length > 0 && fileArtifacts.length > 0) {
                                            return (
                                              <Stack spacing={2}>
                                                <Box>
                                                  <Typography variant="subtitle2">Images</Typography>
                                                  <Box className="artifact-grid">
                                                    {imageArtifacts.map((artifact) =>
                                                      renderArtifactCard(artifact, true)
                                                    )}
                                                  </Box>
                                                </Box>
                                                <Box>
                                                  <Typography variant="subtitle2">Files</Typography>
                                                  <Box className="artifact-list">
                                                    {fileArtifacts.map((artifact) =>
                                                      renderArtifactCard(artifact, false)
                                                    )}
                                                  </Box>
                                                </Box>
                                              </Stack>
                                            );
                                          }
                                          return (
                                            <Box className="artifact-grid">
                                              {artifacts.map((artifact) =>
                                                renderArtifactCard(
                                                  artifact,
                                                  isImageArtifact(artifact.path)
                                                )
                                              )}
                                            </Box>
                                          );
                                        })()}
                                    </Box>
                                  </Box>
                                  {agentMessages && (
                                    <Box component="details" className="log-entry" open>
                                      <summary className="log-summary">
                                        <span>Agent messages</span>
                                        <span className="log-meta">{run.runId}</span>
                                      </summary>
                                      <Box className="log-box">
                                        <pre>{agentMessages}</pre>
                                      </Box>
                                    </Box>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {(taskDetail.runLogs || []).length === 0 && (
                              <Typography color="text.secondary">No logs yet.</Typography>
                            )}
                          </Stack>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Run overrides</Typography>
                            <Typography color="text.secondary" variant="body2">
                              Default: model {formatModelDisplay(taskDetail.model)} · effort{' '}
                              {formatEffortDisplay(taskDetail.reasoningEffort)}
                            </Typography>
                            <TextField
                              select
                              label="Model override"
                              fullWidth
                              value={resumeConfig.modelChoice}
                              onChange={(event) => handleResumeModelChoiceChange(event.target.value)}
                            >
                              {MODEL_OPTIONS.map((option) => (
                                <MenuItem key={option.value || 'default'} value={option.value}>
                                  {option.value === '' ? 'Use task default' : option.label}
                                </MenuItem>
                              ))}
                            </TextField>
                            {resumeConfig.modelChoice === MODEL_CUSTOM_VALUE && (
                              <TextField
                                label="Custom model"
                                fullWidth
                                value={resumeConfig.customModel}
                                onChange={(event) =>
                                  setResumeConfig((prev) => ({
                                    ...prev,
                                    customModel: event.target.value
                                  }))
                                }
                              />
                            )}
                            {resumeConfig.modelChoice &&
                              resumeConfig.modelChoice !== MODEL_CUSTOM_VALUE && (
                                <TextField
                                  select
                                  label="Reasoning effort"
                                  fullWidth
                                  value={resumeConfig.reasoningEffort}
                                  onChange={(event) =>
                                    setResumeConfig((prev) => ({
                                      ...prev,
                                      reasoningEffort: event.target.value
                                    }))
                                  }
                                >
                                  <MenuItem value="">Use task default</MenuItem>
                                  {getEffortOptionsForModel(resumeConfig.modelChoice).map(
                                    (effort) => (
                                      <MenuItem key={effort} value={effort}>
                                        {EFFORT_LABELS[effort] || effort}
                                      </MenuItem>
                                    )
                                  )}
                                </TextField>
                              )}
                            {resumeConfig.modelChoice === MODEL_CUSTOM_VALUE && (
                              <TextField
                                label="Custom reasoning effort"
                                fullWidth
                                value={resumeConfig.customReasoningEffort}
                                onChange={(event) =>
                                  setResumeConfig((prev) => ({
                                    ...prev,
                                    customReasoningEffort: event.target.value
                                  }))
                                }
                                placeholder="none | low | medium | high | xhigh"
                              />
                            )}
                          </Stack>
                          <TextField
                            label="Resume prompt"
                            fullWidth
                            multiline
                            minRows={3}
                            value={resumePrompt}
                            onChange={(event) => setResumePrompt(event.target.value)}
                          />
                          <Stack direction="row" spacing={1} alignItems="center">
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={resumeUseHostDockerSocket}
                                  onChange={(event) => {
                                    setResumeUseHostDockerSocket(event.target.checked);
                                    setResumeDockerTouched(true);
                                  }}
                                />
                              }
                              label="Use host Docker socket for this run"
                            />
                            <Tooltip title="Grants root-equivalent access to the host via Docker. Disable if you do not trust the task.">
                              <WarningAmberIcon color="warning" fontSize="small" />
                            </Tooltip>
                          </Stack>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <Button
                              variant="contained"
                              onClick={handleResumeTask}
                              disabled={loading || !resumePrompt.trim()}
                            >
                              Continue task
                            </Button>
                            <Button variant="outlined" onClick={handlePushTask} disabled={loading}>
                              Push
                            </Button>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Tooltip title="Stop task">
                                <span>
                                  <IconButton
                                    color="error"
                                    onClick={() => handleStopTask(taskDetail.taskId)}
                                    disabled={loading || taskDetail.status !== 'running'}
                                    aria-label="Stop task"
                                  >
                                    <StopCircleOutlinedIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Remove task">
                                <span>
                                  <IconButton
                                    color="secondary"
                                    onClick={() => handleDeleteTask(taskDetail.taskId)}
                                    disabled={loading}
                                    aria-label="Remove task"
                                  >
                                    <DeleteOutlineIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </Stack>
                      </Stack>
                    )}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
          {selectedTaskId && showScrollTop && (
            <Tooltip title="Scroll to top">
              <IconButton
                color="primary"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Scroll to top"
                sx={{
                  position: 'fixed',
                  bottom: { xs: 24, md: 32 },
                  right: { xs: 16, md: 24 },
                  backgroundColor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 3,
                  zIndex: 10,
                  '&:hover': {
                    backgroundColor: 'background.paper'
                  }
                }}
              >
                <KeyboardArrowUpIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {activeTab === 2 && (
        <Box className="section-shell fade-in">
          <Stack spacing={2}>
            <Card className="panel-card">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" className="panel-title">
                      Accounts
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => refreshAccounts()}
                      disabled={loading}
                    >
                      Refresh
                    </Button>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                    >
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
                      <Typography color="text.secondary">
                        Usage limits have not been loaded yet.
                      </Typography>
                    )}
                    {rateLimits && (
                      <Box className="log-box">
                        <Stack spacing={1.5}>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            {renderRateLimitWindow('Primary window', rateLimits.primary)}
                            {renderRateLimitWindow('Secondary window', rateLimits.secondary)}
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
                  </Stack>
                  <Divider />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Rotation queue</Typography>
                      <Typography color="text.secondary">
                        Active account is first. Usage-limit failures auto-rotate.
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleRotateAccount}
                      disabled={loading || accountState.accounts.length < 2}
                    >
                      Rotate now
                    </Button>
                  </Stack>
                  <Divider />
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Add account</Typography>
                        <Typography color="text.secondary">
                          Paste credentials from a local auth.json file.
                        </Typography>
                      </Stack>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddOutlinedIcon />}
                        onClick={() => setShowAccountForm((prev) => !prev)}
                      >
                        {showAccountForm ? 'Hide form' : 'New account'}
                      </Button>
                    </Stack>
                    <Collapse in={showAccountForm} unmountOnExit>
                      <Stack spacing={2}>
                        <Typography color="text.secondary">
                          Copy credentials from any local terminal and paste them here.
                        </Typography>
                        <Box className="log-box">
                          <pre>{`CODEX_HOME="$PWD/.codex-auth" sh -c 'mkdir -p "$CODEX_HOME" && codex login' && cat "$PWD/.codex-auth/auth.json"`}</pre>
                        </Box>
                        <Stack spacing={2}>
                          <TextField
                            label="Account label"
                            fullWidth
                            value={accountForm.label}
                            onChange={(event) =>
                              setAccountForm((prev) => ({ ...prev, label: event.target.value }))
                            }
                            placeholder="Personal / Work / Alt"
                          />
                          <TextField
                            label="auth.json contents"
                            fullWidth
                            multiline
                            minRows={6}
                            value={accountForm.authJson}
                            onChange={(event) =>
                              setAccountForm((prev) => ({ ...prev, authJson: event.target.value }))
                            }
                            placeholder="{...}"
                          />
                          <Button
                            variant="contained"
                            onClick={handleAddAccount}
                            disabled={loading || !accountForm.authJson.trim()}
                          >
                            Add account
                          </Button>
                        </Stack>
                      </Stack>
                    </Collapse>
                  </Stack>
                  <Divider />
                  <Stack spacing={1.5}>
                    {accountState.accounts.map((account) => (
                      <Card key={account.id} className="task-card">
                        <CardContent>
                          <Stack spacing={1}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography fontWeight={600}>
                                {formatAccountLabel(account)}
                              </Typography>
                              {account.isActive && (
                                <Chip size="small" color="success" label="Active" />
                              )}
                            </Stack>
                            <Typography color="text.secondary" className="mono">
                              {account.id}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Chip size="small" label={`Queue #${account.position}`} />
                              {account.createdAt && (
                                <Chip
                                  size="small"
                                  label={`Added ${formatTimestamp(account.createdAt)}`}
                                />
                              )}
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleActivateAccount(account.id)}
                                disabled={loading || account.isActive}
                              >
                                Make active
                              </Button>
                              <Button
                                size="small"
                                color="secondary"
                                onClick={() => handleDeleteAccount(account.id)}
                                disabled={loading || account.isActive}
                              >
                                Remove
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                    {accountState.accounts.length === 0 && (
                      <Typography color="text.secondary">
                        No accounts yet. Add one to enable rotation.
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}

      {activeTab === 3 && (
        <Box className="section-shell fade-in">
          <Stack spacing={2}>
            <Card className="panel-card">
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="h6" className="panel-title">
                      Codex Docker Image
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => refreshImageInfo()}
                      disabled={imageLoading || imageUpdating}
                    >
                      Refresh
                    </Button>
                  </Stack>
                  {imageLoading && (
                    <Typography color="text.secondary">Loading image details...</Typography>
                  )}
                  {!imageLoading && (
                    <Stack spacing={1}>
                      <Typography>
                        Image: <span className="mono">{imageInfo?.imageName || 'unknown'}</span>
                      </Typography>
                      <Typography>Created: {formatTimestamp(imageInfo?.imageCreatedAt)}</Typography>
                      {imageInfo?.imageId && (
                        <Typography className="mono">ID: {imageInfo.imageId}</Typography>
                      )}
                      {imageInfo && imageInfo.present === false && (
                        <Typography color="text.secondary">
                          Image not found locally. Pull to download it.
                        </Typography>
                      )}
                    </Stack>
                  )}
                  <Button variant="contained" onClick={handlePullImage} disabled={imageUpdating}>
                    {imageUpdating ? 'Updating image...' : 'Update image'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )}

      {error && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default App;
