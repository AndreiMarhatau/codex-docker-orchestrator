import { Box, Button, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { buildDiffRows, getDiffStats } from '../../../diff-helpers.js';

function DiffStats({ additions, deletions }) {
  if (!additions && !deletions) {
    return null;
  }
  return (
    <span className="diff-stats">
      {additions > 0 && <span className="diff-add">+{additions}</span>}
      {deletions > 0 && <span className="diff-del">-{deletions}</span>}
    </span>
  );
}

function DiffTable({ diffText }) {
  const rows = useMemo(() => buildDiffRows(diffText), [diffText]);
  if (!rows.length) {
    return <Typography color="text.secondary">No diff content.</Typography>;
  }
  return (
    <Box className="diff-table">
      {rows.map((row, index) => (
        <Box key={`${row.type}-${index}`} className={`diff-row diff-${row.type}`}>
          <span className="diff-cell diff-line">{row.oldLine}</span>
          <span className="diff-cell diff-line">{row.newLine}</span>
          <span className="diff-cell diff-content">{row.content || ' '}</span>
        </Box>
      ))}
    </Box>
  );
}

function TaskDiff({ tasksState }) {
  const { detail } = tasksState;
  const { taskDiff, revealedDiffs, revealDiff } = detail;
  const diffStats = useMemo(() => {
    if (!taskDiff?.available) {
      return { byPath: {}, totals: { additions: 0, deletions: 0 } };
    }
    const byPath = {};
    let additions = 0;
    let deletions = 0;
    for (const file of taskDiff.files) {
      const stats = getDiffStats(file.diff);
      byPath[file.path] = stats;
      additions += stats.additions;
      deletions += stats.deletions;
    }
    return { byPath, totals: { additions, deletions } };
  }, [taskDiff]);
  const showTotals =
    diffStats.totals.additions > 0 || diffStats.totals.deletions > 0;

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
          {taskDiff?.available && showTotals && (
            <DiffStats
              additions={diffStats.totals.additions}
              deletions={diffStats.totals.deletions}
            />
          )}
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
                  <span className="log-meta">
                    <span>{`${file.lineCount} lines`}</span>
                    <DiffStats
                      additions={diffStats.byPath[file.path]?.additions || 0}
                      deletions={diffStats.byPath[file.path]?.deletions || 0}
                    />
                  </span>
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
                    <Box className="diff-box">
                      <DiffTable diffText={file.diff} />
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
