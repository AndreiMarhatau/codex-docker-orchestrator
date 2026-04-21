import { Box, Stack, Typography } from '@mui/material';
import DisclosureSection from '../../../../components/DisclosureSection.jsx';

function RunAgentMessages({ runId, timeline }) {
  return (
    <Stack spacing={1.1} className="run-timeline-stream">
      {timeline.map((item, index) => {
        if (item.type === 'message') {
          return (
            <Typography
              key={`${runId}-agent-message-${index}`}
              className="agent-message-item"
              component="div"
            >
              {item.text}
            </Typography>
          );
        }

        const title =
          item.summaries.length === 1
            ? item.summaries[0].label
            : `${item.summaries.length} actions`;
        const preview =
          item.summaries.length === 1
            ? item.summaries[0].detail
            : item.summaries
                .slice(0, 2)
                .map((summary) => summary.detail)
                .filter(Boolean)
                .join(' · ');

        return (
          <DisclosureSection
            key={`${runId}-timeline-group-${index}`}
            className="agent-inline-summary agent-inline-summary--subtle"
            title={title}
          >
            <Stack spacing={0.9}>
              {preview ? (
                <Typography className="agent-inline-preview" color="text.secondary" variant="body2">
                  {preview}
                </Typography>
              ) : null}
              {item.entries.map((entry, entryIndex) => (
                <Box
                  key={entry?.id || `${runId}-timeline-entry-${index}-${entryIndex}`}
                  className="agent-inline-detail"
                >
                  <Typography className="mono" variant="body2">
                    {item.summaries[entryIndex]?.label || entry?.type || 'event'}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {item.summaries[entryIndex]?.detail || ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </DisclosureSection>
        );
      })}
    </Stack>
  );
}

export default RunAgentMessages;
