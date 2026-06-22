import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Button, Typography, Alert, Paper } from '@mui/material';
import { Tv } from '@mui/icons-material';
import { authApi } from '../services/endpoints';
import { useWallboardAuthStore } from '../stores/wallboardAuthStore';

export function WallboardLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useWallboardAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: tokens } = await authApi.wallboardLogin(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const { data: user } = await authApi.meWithToken(tokens.access_token);
      setUser(user);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid credentials or account disabled');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#020617',
        background: 'radial-gradient(ellipse at center, rgba(30,58,138,0.25) 0%, #020617 70%)',
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 4,
          width: 400,
          maxWidth: '90vw',
          bgcolor: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(59,130,246,0.3)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Tv sx={{ color: '#3b82f6' }} />
          <Typography variant="h5" fontWeight={700}>SOC Wallboard</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sign in for the live operations display. Sessions stay active for 30 days.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          fullWidth label="Email" type="email" margin="normal"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <TextField
          fullWidth label="Password" type="password" margin="normal"
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        <Button
          fullWidth type="submit" variant="contained" size="large"
          disabled={loading} sx={{ mt: 2 }}
        >
          {loading ? 'Signing in...' : 'Enter Wallboard'}
        </Button>
      </Paper>
    </Box>
  );
}
