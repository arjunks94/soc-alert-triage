import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  icon: ReactNode;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({ label, value, color, icon, onClick, active }: StatCardProps) {
  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      sx={{
        p: 2,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.3) 100%)`,
        border: `1px solid ${active ? color : `${color}33`}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: onClick ? 'pointer' : 'default',
        outline: active ? `2px solid ${color}55` : 'none',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${color}22`,
        } : {},
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${color}18`,
          color,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1, fontFamily: 'monospace' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}
