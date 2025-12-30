import { MenuItem, Stack, TextField } from '@mui/material';
import { EFFORT_LABELS, MODEL_CUSTOM_VALUE, MODEL_OPTIONS } from '../../../constants.js';
import { getEffortOptionsForModel } from '../../../model-helpers.js';

function RunOverrideForm({ detail, handleResumeModelChoiceChange }) {
  return (
    <Stack spacing={1}>
      <TextField
        select
        label="Model override"
        fullWidth
        value={detail.resumeConfig.modelChoice}
        onChange={(event) => handleResumeModelChoiceChange(event.target.value)}
      >
        {MODEL_OPTIONS.map((option) => (
          <MenuItem key={option.value || 'default'} value={option.value}>
            {option.value === '' ? 'Use task default' : option.label}
          </MenuItem>
        ))}
      </TextField>
      {detail.resumeConfig.modelChoice === MODEL_CUSTOM_VALUE && (
        <TextField
          label="Custom model"
          fullWidth
          value={detail.resumeConfig.customModel}
          onChange={(event) =>
            detail.setResumeConfig((prev) => ({ ...prev, customModel: event.target.value }))
          }
        />
      )}
      {detail.resumeConfig.modelChoice &&
        detail.resumeConfig.modelChoice !== MODEL_CUSTOM_VALUE && (
          <TextField
            select
            label="Reasoning effort"
            fullWidth
            value={detail.resumeConfig.reasoningEffort}
            onChange={(event) =>
              detail.setResumeConfig((prev) => ({
                ...prev,
                reasoningEffort: event.target.value
              }))
            }
          >
            <MenuItem value="">Use task default</MenuItem>
            {getEffortOptionsForModel(detail.resumeConfig.modelChoice).map((effort) => (
              <MenuItem key={effort} value={effort}>
                {EFFORT_LABELS[effort] || effort}
              </MenuItem>
            ))}
          </TextField>
        )}
      {detail.resumeConfig.modelChoice === MODEL_CUSTOM_VALUE && (
        <TextField
          label="Custom reasoning effort"
          fullWidth
          value={detail.resumeConfig.customReasoningEffort}
          onChange={(event) =>
            detail.setResumeConfig((prev) => ({
              ...prev,
              customReasoningEffort: event.target.value
            }))
          }
          placeholder="none | low | medium | high | xhigh"
        />
      )}
    </Stack>
  );
}

export default RunOverrideForm;
