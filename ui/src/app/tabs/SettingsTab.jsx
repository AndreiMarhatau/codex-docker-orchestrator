import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiRequest } from '../../api.js';

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

  const handleConfigExpanded = useCallback((_event, expanded) => {
    setConfigExpanded(expanded);
  }, []);

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
    <Accordion expanded={configExpanded} onChange={handleConfigExpanded}>
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

function GitSettingsForm({ refreshAll, setupState }) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/api/settings/git', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      await refreshAll();
      setToken('');
      setNotice(token.trim() ? 'Git token saved.' : 'Git token cleared.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to save git token.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/api/settings/git', {
        method: 'POST',
        body: JSON.stringify({ token: '' })
      });
      await refreshAll();
      setToken('');
      setNotice('Git token cleared.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to clear git token.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">Git Setup</Typography>
          <Typography color="text.secondary">
            Provide a GitHub token before creating environments or tasks. Commits use the built-in identity:
            {' '}
            <code>{setupState?.gitUserName || 'Codex Agent'}</code>
            {' <'}
            <code>{setupState?.gitUserEmail || 'codex@openai.com'}</code>
            {'>'}
            .
          </Typography>
          <Typography color="text.secondary">
            Token configured:
            {' '}
            {setupState?.gitTokenConfigured ? 'yes' : 'no'}
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="GitHub token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ghp_..."
              />
              {error && <Typography color="error">{error}</Typography>}
              {notice && <Typography color="text.secondary">{notice}</Typography>}
              <Stack direction="row" spacing={1.5}>
                <Button type="submit" variant="contained" disabled={saving || !token.trim()}>
                  {saving ? 'Saving...' : 'Save token'}
                </Button>
                {setupState?.gitTokenConfigured && (
                  <Button variant="outlined" disabled={saving} onClick={handleClear}>
                    {saving ? 'Clearing...' : 'Clear token'}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SettingsTab({ authState, refreshAll, setupState }) {
  const { passwordRequired, updatePassword } = authState;
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!password.trim()) {
      setError('Enter a password.');
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword({
        password: password.trim(),
        currentPassword: currentPassword.trim()
      });
      setNotice(passwordRequired ? 'Password updated.' : 'Password set.');
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (submitError) {
      setError(submitError.message || 'Unable to save password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box className="section-shell fade-in">
      <Card className="settings-card">
        <CardContent>
          <Stack spacing={2.5}>
            <GitSettingsForm refreshAll={refreshAll} setupState={setupState} />
            <ConfigFileEditor />
            <Stack spacing={0.5}>
              <Typography variant="h5">UI password</Typography>
              <Typography color="text.secondary">
                {passwordRequired
                  ? 'Change the password used to unlock this UI.'
                  : 'Set a password to lock the UI and API.'}
              </Typography>
            </Stack>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                {passwordRequired && (
                  <TextField
                    label="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                )}
                <TextField
                  label={passwordRequired ? 'New password' : 'Password'}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <TextField
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                {error && <Typography color="error">{error}</Typography>}
                {notice && <Typography color="text.secondary">{notice}</Typography>}
                <Button type="submit" variant="contained" disabled={saving}>
                  {passwordRequired ? 'Update password' : 'Set password'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SettingsTab;
