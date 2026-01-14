import { useState } from 'react';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';

function SettingsTab({ authState }) {
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
    } catch (err) {
      setError(err.message || 'Unable to save password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box className="section-shell fade-in">
      <Card className="settings-card">
        <CardContent>
          <Stack spacing={2.5}>
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
