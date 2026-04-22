import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { EFFORT_LABELS, MODEL_CUSTOM_VALUE, MODEL_OPTIONS } from '../../../constants.js';
import { getEffortOptionsForModel } from '../../../model-helpers.js';

function RunOverrideForm({
  detail,
  effortHelper = '',
  effortLabel = 'Effort (optional)',
  handleResumeModelChoiceChange,
  modelHelper = '',
  modelLabel = 'Model (optional)'
}) {
  return (
    <Stack spacing={2.25}>
      <Stack spacing={0.7}>
        <TextField
          select
          label={modelLabel}
          fullWidth
          value={detail.resumeConfig.modelChoice}
          onChange={(event) => handleResumeModelChoiceChange(event.target.value)}
          className="task-compose-field"
        >
          {MODEL_OPTIONS.map((option) => (
            <MenuItem key={option.value || 'default'} value={option.value}>
              {option.value === '' ? 'Default (recommended)' : option.label}
            </MenuItem>
          ))}
        </TextField>
        {modelHelper ? <Typography className="task-compose-helper">{modelHelper}</Typography> : null}
      </Stack>

      {detail.resumeConfig.modelChoice === MODEL_CUSTOM_VALUE && (
        <TextField
          label="Custom model"
          fullWidth
          value={detail.resumeConfig.customModel}
          onChange={(event) =>
            detail.setResumeConfig((prev) => ({ ...prev, customModel: event.target.value }))
          }
          className="task-compose-field"
        />
      )}

      <Stack spacing={0.7}>
        {detail.resumeConfig.modelChoice === MODEL_CUSTOM_VALUE ? (
          <TextField
            label={effortLabel}
            fullWidth
            value={detail.resumeConfig.customReasoningEffort}
            onChange={(event) =>
              detail.setResumeConfig((prev) => ({
                ...prev,
                customReasoningEffort: event.target.value
              }))
            }
            className="task-compose-field"
            placeholder="Default"
          />
        ) : (
          <TextField
            select
            label={effortLabel}
            fullWidth
            value={detail.resumeConfig.reasoningEffort}
            onChange={(event) =>
              detail.setResumeConfig((prev) => ({
                ...prev,
                reasoningEffort: event.target.value
              }))
            }
            className="task-compose-field"
          >
            <MenuItem value="">Default</MenuItem>
            {(detail.resumeConfig.modelChoice
              ? getEffortOptionsForModel(detail.resumeConfig.modelChoice)
              : []).map((effort) => (
              <MenuItem key={effort} value={effort}>
                {EFFORT_LABELS[effort] || effort}
              </MenuItem>
            ))}
          </TextField>
        )}
        {effortHelper ? <Typography className="task-compose-helper">{effortHelper}</Typography> : null}
      </Stack>
    </Stack>
  );
}

export default RunOverrideForm;
