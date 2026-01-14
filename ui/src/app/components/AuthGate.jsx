import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from '@mui/material';

function AuthGate({ authState }) {
  const { checking, error, login, passwordRequired } = authState;
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const overlayLabel = useMemo(() => {
    if (checking) {
      return 'Checking access...';
    }
    if (passwordRequired) {
      return 'Password required';
    }
    return 'Ready';
  }, [checking, passwordRequired]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password.trim()) {
      setLocalError('Enter a password to continue.');
      return;
    }
    setLocalError('');
    setSubmitting(true);
    try {
      await login(password.trim());
      setPassword('');
    } catch (err) {
      setLocalError(err.message || 'Password rejected.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box className="auth-overlay" role="dialog" aria-label={overlayLabel}>
      <Card className="auth-card">
        <CardContent>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h5">Orchestrator locked</Typography>
              <Typography color="text.secondary">
                Enter the UI password to continue.
              </Typography>
            </Stack>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  autoFocus
                  fullWidth
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={checking || submitting}
                />
                {(localError || error) && (
                  <Typography color="error">{localError || error}</Typography>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={checking || submitting}
                  startIcon={checking || submitting ? <CircularProgress size={16} /> : null}
                >
                  Unlock
                </Button>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default AuthGate;
