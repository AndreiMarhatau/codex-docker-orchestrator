import { MODEL_CUSTOM_VALUE, MODEL_EFFORTS } from './constants.js';

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
  if (!modelChoice) {
    return '';
  }
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

export {
  formatEffortDisplay,
  formatModelDisplay,
  getEffortOptionsForModel,
  resolveModelValue,
  resolveReasoningEffortValue
};
