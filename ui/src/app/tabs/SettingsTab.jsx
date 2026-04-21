import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SectionHeader from '../components/SectionHeader.jsx';
import ConfigFileEditor from './settings/ConfigFileEditor.jsx';
import GitSettingsForm from './settings/GitSettingsForm.jsx';

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
    <Box className="section-shell dense-workstation-tab dense-workstation-tab--settings fade-in">
      <Box className="dense-tab-header">
        <SectionHeader
          eyebrow="Configuration"
          icon={<SettingsOutlinedIcon fontSize="small" />}
          title="Settings"
          description="Keep git access, the local config file, and UI authentication in one place."
          chips={[
            {
              label: setupState?.gitTokenConfigured ? 'Git token configured' : 'Git token missing',
              tone: setupState?.gitTokenConfigured ? 'live' : 'muted'
            },
            {
              label: passwordRequired ? 'Password enabled' : 'Password not set',
              tone: passwordRequired ? 'neutral' : 'muted'
            }
          ]}
        />
      </Box>
      <Stack spacing={1.5}>
        <GitSettingsForm refreshAll={refreshAll} setupState={setupState} />
        <Box className="dense-panel dense-panel--form" sx={{ minWidth: 0 }}>
          <Stack spacing={1.5}>
            <Stack spacing={0.35}>
              <Typography variant="h6" className="dense-panel-title">UI password</Typography>
              <Typography color="text.secondary" className="dense-panel-copy">
                {passwordRequired
                  ? 'Change the password used to unlock this UI.'
                  : 'Set a password to lock the UI and API.'}
              </Typography>
            </Stack>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={1.25}>
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
                {error && <Typography color="error" variant="body2">{error}</Typography>}
                {notice && <Typography color="text.secondary" variant="body2">{notice}</Typography>}
                <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
                  {passwordRequired ? 'Update password' : 'Set password'}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Box>
        <ConfigFileEditor />
      </Stack>
    </Box>
  );
}

export default SettingsTab;
