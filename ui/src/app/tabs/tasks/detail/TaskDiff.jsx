import { Box, Button, Stack, Typography } from '@mui/material';

function TaskDiff({ tasksState }) {
  const { detail } = tasksState;
  const { taskDiff, revealedDiffs, revealDiff } = detail;

  return (
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
        {!taskDiff && <Typography color="text.secondary">Loading diff...</Typography>}
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
                      <Button size="small" variant="outlined" onClick={() => revealDiff(file.path)}>
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
  );
}

export default TaskDiff;
