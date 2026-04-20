import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiRequest } from '../../../api.js';

function ConfigFileEditor() {
  const [configExpanded, setConfigExpanded] = useState(false);
  const [configContent, setConfigContent] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configNotice, setConfigNotice] = useState('');

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const result = await apiRequest('/api/settings/config');
      setConfigContent(result?.content || '');
      setConfigLoaded(true);
      setConfigNotice('');
    } catch (loadError) {
      setConfigError(loadError.message || 'Unable to load config.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configExpanded || configLoaded) {
      return;
    }
    loadConfig();
  }, [configExpanded, configLoaded, loadConfig]);

  async function handleConfigSubmit(event) {
    event.preventDefault();
    setConfigError('');
    setConfigNotice('');
    if (!configLoaded) {
      setConfigError('Load config first before saving.');
      return;
    }
    setConfigSaving(true);
    try {
      await apiRequest('/api/settings/config', {
        method: 'POST',
        body: JSON.stringify({ content: configContent })
      });
      setConfigNotice('config.toml saved.');
    } catch (saveError) {
      setConfigError(saveError.message || 'Unable to save config.');
    } finally {
      setConfigSaving(false);
    }
  }

  return (
    <Accordion expanded={configExpanded} onChange={(_event, expanded) => setConfigExpanded(expanded)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6">Config file (config.toml)</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Typography color="text.secondary">
            This editor updates <code>config.toml</code> in your Codex home directory.
          </Typography>
          {configError && <Typography color="error">{configError}</Typography>}
          {configNotice && <Typography color="text.secondary">{configNotice}</Typography>}
          {configExpanded && (configLoading ? (
            <Typography>Loading config...</Typography>
          ) : (
            <Box component="form" onSubmit={handleConfigSubmit}>
              <Stack spacing={1.5}>
                <TextField
                  label="config.toml"
                  multiline
                  minRows={12}
                  value={configContent}
                  onChange={(event) => setConfigContent(event.target.value)}
                  fullWidth
                  variant="outlined"
                />
                <Button type="submit" variant="contained" disabled={configSaving || configLoading}>
                  {configSaving ? 'Saving...' : 'Save config'}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export default ConfigFileEditor;
