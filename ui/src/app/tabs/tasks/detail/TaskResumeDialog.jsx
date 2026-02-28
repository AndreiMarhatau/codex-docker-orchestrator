import { useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { resolveModelValue, resolveReasoningEffortValue } from '../../../model-helpers.js';
import TaskResumeSettingsPopover from './TaskResumeSettingsPopover.jsx';
import {
  ResumeActiveTags,
  ResumeExistingAttachments,
  ResumeNewAttachments
} from './TaskResumeChips.jsx';

function TaskResumeDialog({
  actions,
  data,
  detail,
  envs,
  handleResumeModelChoiceChange,
  onClose,
  open
}) {
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const closeDialog = () => {
    setSettingsAnchor(null);
    onClose();
  };
  const hasSettingsEnabled = useMemo(
    () =>
      Boolean(resolveModelValue(detail.resumeConfig.modelChoice, detail.resumeConfig.customModel)) ||
      Boolean(resolveReasoningEffortValue(detail.resumeConfig)) ||
      detail.resumeUseHostDockerSocket ||
      detail.resumeContextRepos.some((repo) => repo.envId),
    [detail]
  );

  return (
    <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
      <DialogTitle>Ask for changes</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Continuation prompt"
            fullWidth
            multiline
            minRows={4}
            value={detail.resumePrompt}
            onChange={(event) => detail.setResumePrompt(event.target.value)}
            disabled={data.loading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 0.5 }}>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Attach files">
                      <IconButton
                        size="small"
                        component="label"
                        aria-label="Add attachments"
                        color={detail.resumeFiles.taskFiles.length > 0 ? 'primary' : 'default'}
                        disabled={data.loading || detail.resumeFiles.taskFileUploading}
                      >
                        <AttachFileOutlinedIcon fontSize="small" />
                        <input
                          ref={detail.resumeFiles.taskFileInputRef}
                          type="file"
                          hidden
                          multiple
                          onChange={detail.resumeFiles.handleTaskFilesSelected}
                        />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Additional settings">
                      <IconButton
                        size="small"
                        aria-label="Additional settings"
                        color={hasSettingsEnabled ? 'primary' : 'default'}
                        onClick={(event) => setSettingsAnchor(event.currentTarget)}
                      >
                        <SettingsOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </InputAdornment>
              )
            }}
          />
          <ResumeActiveTags detail={detail} />
          {detail.resumeFiles.taskFileError && (
            <Typography color="error">{detail.resumeFiles.taskFileError}</Typography>
          )}
          <ResumeExistingAttachments detail={detail} />
          <ResumeNewAttachments detail={detail} loading={data.loading} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDialog}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            actions.handleResumeTask();
            closeDialog();
          }}
          disabled={data.loading || detail.resumeFiles.taskFileUploading || !detail.resumePrompt.trim()}
        >
          Continue task
        </Button>
      </DialogActions>
      <TaskResumeSettingsPopover
        anchorEl={settingsAnchor}
        detail={detail}
        envs={envs}
        handleResumeModelChoiceChange={handleResumeModelChoiceChange}
        loading={data.loading}
        onClose={() => setSettingsAnchor(null)}
      />
    </Dialog>
  );
}

export default TaskResumeDialog;
