import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface GlassPanelProps {
  title?: string;
  children: ReactNode;
  accent?: string;
  action?: ReactNode;
  noPadding?: boolean;
  sx?: Record<string, unknown>;
}

export function GlassPanel({
  title,
  children,
  accent = '#3b82f6',
  action,
  noPadding = false,
  sx = {},
}: GlassPanelProps) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.95) 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        height: '100%',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        },
        ...sx,
      }}
    >
      {title && (
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(59,130,246,0.12)',
            background: 'rgba(59,130,246,0.04)',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: accent,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Typography>
          {action}
        </Box>
      )}
      <Box sx={{ p: noPadding ? 0 : 2 }}>{children}</Box>
    </Box>
  );
}

export const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0,0,0,0.25)',
    borderRadius: 2,
    fontSize: '0.85rem',
    '& fieldset': { borderColor: 'rgba(59,130,246,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(59,130,246,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8rem' },
};
