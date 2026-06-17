import { Box, Typography } from '@mui/material';
import { Shield, Lock } from '@mui/icons-material';

export function WallboardCenter() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        position: 'relative',
        py: 2,
      }}
    >
      {/* Decorative rings */}
      <Box
        sx={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          border: '1px solid rgba(59,130,246,0.15)',
          animation: 'pulse-ring 4s ease-in-out infinite',
          '@keyframes pulse-ring': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.3 },
            '50%': { transform: 'scale(1.05)', opacity: 0.6 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          border: '1px dashed rgba(59,130,246,0.2)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(59,130,246,0.4)',
          }}
        >
          <Shield sx={{ fontSize: 48, color: '#3b82f6', filter: 'drop-shadow(0 0 8px #3b82f6)' }} />
          <Lock
            sx={{
              position: 'absolute',
              fontSize: 20,
              color: '#60a5fa',
              bottom: 18,
            }}
          />
        </Box>
      </Box>

      <Typography
        sx={{
          fontSize: '4.5rem',
          fontWeight: 900,
          letterSpacing: '0.2em',
          background: 'linear-gradient(180deg, #e2e8f0 0%, #64748b 50%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 30px rgba(59,130,246,0.3)',
          lineHeight: 1,
          mb: 1,
        }}
      >
        SOC
      </Typography>

      <Typography
        sx={{
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.35em',
          color: '#3b82f6',
          textTransform: 'uppercase',
          mb: 1.5,
        }}
      >
        Alert Triage Dashboard
      </Typography>

      <Typography
        sx={{
          fontSize: '0.65rem',
          letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
        }}
      >
        Detect · Analyze · Respond · Defend
      </Typography>

      {/* Scan line effect */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          left: '10%',
          right: '10%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)',
          animation: 'scan 3s linear infinite',
          '@keyframes scan': {
            '0%': { transform: 'translateY(-60px)', opacity: 0 },
            '50%': { opacity: 1 },
            '100%': { transform: 'translateY(60px)', opacity: 0 },
          },
        }}
      />
    </Box>
  );
}
