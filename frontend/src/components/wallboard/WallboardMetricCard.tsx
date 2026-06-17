import { Box, Typography } from '@mui/material';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  label: string;
  value: number | string;
  color: string;
  sparkData?: number[];
}

export function WallboardMetricCard({ label, value, color, sparkData = [] }: MetricCardProps) {
  const chartData = sparkData.length > 0
    ? sparkData.map((v, i) => ({ i, v }))
    : [{ i: 0, v: 0 }, { i: 1, v: 0 }];

  return (
    <Box
      sx={{
        p: 1.25,
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${color}33`,
        borderRadius: '4px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 72,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.6rem',
          fontWeight: 800,
          color,
          fontFamily: '"JetBrains Mono", monospace',
          lineHeight: 1,
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, opacity: 0.6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
