import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  gradient?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  gradient = 'linear-gradient(90deg, #f1f5f9, #3b82f6)',
}: PageHeaderProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
      <Box>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{
            background: gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
