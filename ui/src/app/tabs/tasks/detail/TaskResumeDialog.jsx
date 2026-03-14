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
import UploadProgress from '../../../components/UploadProgress.jsx';
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
  const dialogBusy = data.loading || detail.resumeFiles.taskFileUploading;
  const closeDialog = () => {
    if (dialogBusy) {
      return;
    }
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
  const uploadProgress = detail.resumeFiles.taskFileUploadProgress;
  const uploadPercent = Math.max(0, Math.min(100, Math.round(uploadProgress?.percent || 0)));

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
            disabled={dialogBusy}
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
                        disabled={dialogBusy}
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
                        disabled={dialogBusy}
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
          <ResumeActiveTags detail={detail} loading={dialogBusy} />
          {detail.resumeFiles.taskFileError && (
            <Typography color="error">{detail.resumeFiles.taskFileError}</Typography>
          )}
          <UploadProgress progress={uploadProgress} />
          <ResumeExistingAttachments detail={detail} loading={dialogBusy} />
          <ResumeNewAttachments detail={detail} loading={dialogBusy} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDialog} disabled={dialogBusy}>Cancel</Button>
        <Button
          variant="contained"
          onClick={async () => {
            setSettingsAnchor(null);
            const completed = await actions.handleResumeTask();
            if (completed !== false) {
              setSettingsAnchor(null);
              onClose();
            }
          }}
          disabled={dialogBusy || !detail.resumePrompt.trim()}
        >
          {detail.resumeFiles.taskFileUploading
            ? `Uploading attachments... ${uploadPercent}%`
            : 'Continue task'}
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
