import { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert, CircularProgress,
} from '@mui/material';
import { Security } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/endpoints';
import { useAuthStore } from '../stores/authStore';
import { GlassPanel, fieldSx } from '../components/ui/GlassPanel';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: tokens } = await authApi.login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      const { data: user } = await authApi.me();
      setUser(user);
      navigate('/');
    } catch {
      setError('Invalid email or password');
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
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 40%, #020617 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          top: -200,
          right: -100,
        },
      }}
    >
      <Box sx={{ width: 420, maxWidth: '90vw', position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Security sx={{ fontSize: 52, color: '#3b82f6', mb: 1, filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.5))' }} />
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              background: 'linear-gradient(90deg, #f1f5f9, #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SOC Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Security Operations Center
          </Typography>
        </Box>

        <GlassPanel accent="#3b82f6">
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} margin="normal" required
              sx={fieldSx}
            />
            <TextField
              fullWidth label="Password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} margin="normal" required
              sx={fieldSx}
            />
            <Button
              fullWidth type="submit" variant="contained" size="large"
              disabled={loading}
              sx={{ mt: 2, py: 1.5, fontWeight: 700, boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}
            >
              {loading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>
          </form>
        </GlassPanel>
      </Box>
    </Box>
  );
}
