import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { apiRequest } from '../../../api.js';

function GitSettingsForm({ refreshAll, setupState }) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function saveToken(nextToken) {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await apiRequest('/api/settings/git', {
        method: 'POST',
        body: JSON.stringify({ token: nextToken })
      });
      await refreshAll();
      setToken('');
      setNotice(nextToken.trim() ? 'Git token saved.' : 'Git token cleared.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to save git token.');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    saveToken(token);
  }

  return (
    <Box className="subpanel-card">
      <Stack spacing={2}>
        <Typography variant="h5">Git Setup</Typography>
        <Typography color="text.secondary">
          Provide a GitHub token before creating environments or tasks. Commits use the built-in
          identity: <code>{setupState?.gitUserName || 'Codex Agent'}</code> {' <'}
          <code>{setupState?.gitUserEmail || 'codex@openai.com'}</code>
          {'>'}.
        </Typography>
        <Typography color="text.secondary">
          Token configured: {setupState?.gitTokenConfigured ? 'yes' : 'no'}
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
                <Button variant="outlined" disabled={saving} onClick={() => saveToken('')}>
                  {saving ? 'Clearing...' : 'Clear token'}
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export default GitSettingsForm;
