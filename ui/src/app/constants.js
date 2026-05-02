const MODEL_CUSTOM_VALUE = 'custom';
const MODEL_OPTIONS = [
  { value: '', label: 'Default (Codex decides)' },
  { value: 'gpt-5.3-codex', label: 'gpt-5.3-codex' },
  { value: 'gpt-5.3-codex-spark', label: 'gpt-5.3-codex-spark' },
  { value: 'gpt-5.1-codex-mini', label: 'gpt-5.1-codex-mini' },
  { value: 'gpt-5.1-codex-max', label: 'gpt-5.1-codex-max' },
  { value: 'gpt-5.2', label: 'gpt-5.2' },
  { value: 'gpt-5.2-codex', label: 'gpt-5.2-codex' },
  { value: MODEL_CUSTOM_VALUE, label: 'Custom model...' }
];
const MODEL_EFFORTS = {
  'gpt-5.3-codex': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.3-codex-spark': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.1-codex-mini': ['low', 'medium', 'high'],
  'gpt-5.1-codex-max': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.2': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.2-codex': ['low', 'medium', 'high', 'xhigh']
};
const EFFORT_LABELS = {
  none: 'none (disable reasoning)',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh'
};
const emptyEnvForm = { repoUrl: '', defaultBranch: 'main', envVarsText: '' };
const emptyTaskForm = {
  envId: '',
  ref: '',
  prompt: '',
  contextRepos: [],
  modelChoice: '',
  customModel: '',
  reasoningEffort: '',
  customReasoningEffort: '',
  useHostDockerSocket: false,
  goalObjective: '',
  autoReview: true
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
const emptyContextRepo = { envId: '', ref: '' };
const MAX_TASK_FILES = 10;
const STATUS_CONFIG = {
  running: {
    label: 'Running',
    icon: 'PlayCircleOutlineIcon',
    fg: '#2563eb',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: '#3b82f6'
  },
  reviewing: {
    label: 'Reviewing',
    icon: 'RateReviewOutlinedIcon',
    fg: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.12)',
    border: '#8b5cf6'
  },
  pushing: {
    label: 'Pushing',
    icon: 'CloudUploadOutlinedIcon',
    fg: '#0891b2',
    bg: 'rgba(8, 145, 178, 0.12)',
    border: '#06b6d4'
  },
  stopping: {
    label: 'Stopping',
    icon: 'HourglassTopIcon',
    fg: '#ca8a04',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: '#f59e0b'
  },
  completed: {
    label: 'Completed',
    icon: 'CheckCircleOutlineIcon',
    fg: '#16a34a',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: '#22c55e'
  },
  failed: {
    label: 'Failed',
    icon: 'ErrorOutlineIcon',
    fg: '#dc2626',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: '#ef4444'
  },
  stopped: {
    label: 'Stopped',
    icon: 'PauseCircleOutlineIcon',
    fg: '#6b7280',
    bg: 'rgba(100, 116, 139, 0.12)',
    border: '#94a3b8'
  },
  unknown: {
    label: 'Unknown',
    icon: 'HelpOutlineIcon',
    fg: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    border: '#94a3b8'
  }
};

export {
  EFFORT_LABELS,
  MODEL_CUSTOM_VALUE,
  MODEL_EFFORTS,
  MODEL_OPTIONS,
  MAX_TASK_FILES,
  STATUS_CONFIG,
  emptyAccountForm,
  emptyContextRepo,
  emptyEnvForm,
  emptyResumeConfig,
  emptyTaskForm
};
