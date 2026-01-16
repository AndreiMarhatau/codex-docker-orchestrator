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
const emptyEnvForm = { repoUrl: '', defaultBranch: 'main' };
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
  repoReadOnly: false
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
const MAX_TASK_IMAGES = 5;
const MAX_TASK_FILES = 10;
const STATUS_CONFIG = {
  running: {
    label: 'Running',
    icon: 'PlayCircleOutlineIcon',
    fg: '#9a3412',
    bg: '#ffedd5',
    border: '#fdba74'
  },
  stopping: {
    label: 'Stopping',
    icon: 'HourglassTopIcon',
    fg: '#854d0e',
    bg: '#fef9c3',
    border: '#fde047'
  },
  completed: {
    label: 'Completed',
    icon: 'CheckCircleOutlineIcon',
    fg: '#166534',
    bg: '#dcfce7',
    border: '#86efac'
  },
  failed: {
    label: 'Failed',
    icon: 'ErrorOutlineIcon',
    fg: '#b91c1c',
    bg: '#fee2e2',
    border: '#fca5a5'
  },
  stopped: {
    label: 'Stopped',
    icon: 'PauseCircleOutlineIcon',
    fg: '#374151',
    bg: '#e5e7eb',
    border: '#d1d5db'
  },
  unknown: {
    label: 'Unknown',
    icon: 'HelpOutlineIcon',
    fg: '#475569',
    bg: '#e2e8f0',
    border: '#cbd5f5'
  }
};

export {
  EFFORT_LABELS,
  MODEL_CUSTOM_VALUE,
  MODEL_EFFORTS,
  MODEL_OPTIONS,
  MAX_TASK_FILES,
  MAX_TASK_IMAGES,
  STATUS_CONFIG,
  emptyAccountForm,
  emptyContextRepo,
  emptyEnvForm,
  emptyResumeConfig,
  emptyTaskForm
};
