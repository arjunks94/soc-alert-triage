import { Box, Typography } from '@mui/material';
import {
  Security, Search, Analytics, Gavel, Restore,
} from '@mui/icons-material';

const PHASES = [
  { label: 'Prevent', icon: Security },
  { label: 'Detect', icon: Search },
  { label: 'Analyze', icon: Analytics },
  { label: 'Respond', icon: Gavel },
  { label: 'Recover', icon: Restore },
];

export function WallboardFooter() {
  return (
    <Box
      sx={{
        borderTop: '1px solid rgba(59,130,246,0.2)',
        background: 'rgba(2,6,23,0.9)',
        py: 1,
        px: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
          mb: 0.75,
        }}
      >
        {PHASES.map(({ label, icon: Icon }) => (
          <Box
            key={label}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.25,
              opacity: 0.7,
              '&:hover': { opacity: 1 },
            }}
          >
            <Icon sx={{ fontSize: 18, color: '#3b82f6' }} />
            <Typography
              sx={{
                fontSize: '0.55rem',
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography
        sx={{
          textAlign: 'center',
          fontSize: '0.6rem',
          letterSpacing: '0.3em',
          color: 'rgba(255,255,255,0.25)',
          textTransform: 'uppercase',
        }}
      >
        Securing Today, Protecting Tomorrow
      </Typography>
    </Box>
  );
}
