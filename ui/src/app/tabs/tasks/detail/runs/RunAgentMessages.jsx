import { Box, Stack, Typography } from '@mui/material';
import DisclosureSection from '../../../../components/DisclosureSection.jsx';

function RunAgentMessages({ runId, timeline }) {
  return (
    <Stack spacing={1} className="run-timeline-stream">
      {timeline.map((item, index) => {
        if (item.type === 'message') {
          return (
            <Box key={`${runId}-agent-message-${index}`} className="run-message run-message--agent">
              <Typography className="run-message-author">Agent</Typography>
              <Typography className="run-message-text" component="div">
                {item.text}
              </Typography>
            </Box>
          );
        }

        if (item.type === 'review') {
          return (
            <Box key={`${runId}-review-message-${index}`} className="run-message run-message--review">
              <Typography className="run-message-author">{item.label || 'Review'}</Typography>
              <Typography className="run-message-text" component="div">
                {item.text}
              </Typography>
            </Box>
          );
        }

        const title =
          item.summaries.length === 1
            ? item.summaries[0].label
            : `${item.summaries.length} actions`;

        return (
          <DisclosureSection
            key={`${runId}-timeline-group-${index}`}
            className="run-actions-card"
            title={title}
          >
            <Stack spacing={0.9} className="run-actions-list">
              {item.entries.map((entry, entryIndex) => (
                <Box
                  key={entry?.id || `${runId}-timeline-entry-${index}-${entryIndex}`}
                  className="run-action-item"
                >
                  <Typography className="run-action-title">
                    {`${entryIndex + 1}. ${item.summaries[entryIndex]?.label || entry?.type || 'event'}`}
                  </Typography>
                  <Typography className="run-action-detail" variant="body2">
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
