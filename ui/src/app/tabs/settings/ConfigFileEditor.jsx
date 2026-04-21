import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Collapse, Stack, TextField, Typography } from '@mui/material';
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
    <Box className="dense-panel dense-panel--list">
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.35}>
            <Typography variant="h6" className="dense-panel-title">Local config</Typography>
            <Typography color="text.secondary" className="dense-panel-copy">
              Edit <code>config.toml</code> in your Codex home directory when you need to override
              local defaults.
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ExpandMoreIcon />}
            onClick={() => setConfigExpanded((expanded) => !expanded)}
          >
            {configExpanded ? 'Hide editor' : 'Open editor'}
          </Button>
        </Stack>
        {configError && <Typography color="error">{configError}</Typography>}
        {configNotice && <Typography color="text.secondary">{configNotice}</Typography>}
        <Typography variant="body2" color="text.secondary" className="dense-panel-copy">
          Load the current file before saving so you can review what changed.
        </Typography>
        <Collapse in={configExpanded} unmountOnExit>
          <Stack spacing={1.25}>
            {configLoading ? (
              <Typography>Loading config...</Typography>
            ) : (
              <Box component="form" onSubmit={handleConfigSubmit}>
                <Stack spacing={1.25}>
                  <TextField
                    label="config.toml"
                    multiline
                    minRows={12}
                    value={configContent}
                    onChange={(event) => setConfigContent(event.target.value)}
                    fullWidth
                    variant="outlined"
                    inputProps={{ className: 'mono' }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={configSaving || configLoading}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {configSaving ? 'Saving...' : 'Save config'}
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Box>
  );
}

export default ConfigFileEditor;
