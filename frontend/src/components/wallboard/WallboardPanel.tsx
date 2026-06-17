import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface WallboardPanelProps {
  title: string;
  children: ReactNode;
  accent?: string;
  height?: string | number;
  noPadding?: boolean;
}

export function WallboardPanel({
  title,
  children,
  accent = '#3b82f6',
  height = 'auto',
  noPadding = false,
}: WallboardPanelProps) {
  return (
    <Box
      sx={{
        height,
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 100%)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '4px',
        overflow: 'hidden',
        boxShadow: `0 0 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        },
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: '1px solid rgba(59,130,246,0.15)',
          background: 'rgba(59,130,246,0.05)',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: noPadding ? 0 : 1.5, height: 'calc(100% - 32px)', overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}
