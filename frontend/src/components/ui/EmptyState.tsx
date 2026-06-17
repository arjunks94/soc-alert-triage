import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        borderRadius: 3,
        border: '1px dashed rgba(255,255,255,0.1)',
        bgcolor: 'rgba(0,0,0,0.2)',
      }}
    >
      <Box sx={{ color: 'rgba(255,255,255,0.15)', mb: 1, '& svg': { fontSize: 48 } }}>
        {icon}
      </Box>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}
