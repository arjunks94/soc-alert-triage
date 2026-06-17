import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import type { ReactNode } from 'react';
import { severityColors } from '../theme';

interface KPICardProps {
  title: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  subtitle?: string;
  loading?: boolean;
  large?: boolean;
}

export function KPICard({ title, value, icon, color = '#00bcd4', subtitle, loading, large }: KPICardProps) {
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          backgroundColor: color,
        }}
      />
      <CardContent sx={{ p: large ? 3 : 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant={large ? 'h6' : 'body2'} color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={80} height={large ? 56 : 40} />
            ) : (
              <Typography
                variant={large ? 'h2' : 'h4'}
                sx={{ fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace' }}
              >
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box sx={{ color: `${color}88`, fontSize: large ? 48 : 32 }}>{icon}</Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export function SeverityKPICard({ title, value, severity, loading, large }: {
  title: string;
  value: number;
  severity: string;
  loading?: boolean;
  large?: boolean;
}) {
  return (
    <KPICard
      title={title}
      value={value}
      color={severityColors[severity]}
      loading={loading}
      large={large}
    />
  );
}
