import { Box, Typography } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { DashboardSummary } from '../../types';
import type { TopAsset } from '../../types';
import { WallboardPanel } from './WallboardPanel';
import { WallboardMetricCard } from './WallboardMetricCard';

const SEV_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

interface SystemOverviewProps {
  summary: DashboardSummary | undefined;
  timelineSpark: number[];
  containedCount: number;
}

export function WallboardSystemOverview({ summary, timelineSpark, containedCount }: SystemOverviewProps) {
  return (
    <WallboardPanel title="System Overview" accent="#3b82f6">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
        }}
      >
        <WallboardMetricCard
          label="Critical Alerts"
          value={summary?.critical ?? 0}
          color="#ef4444"
          sparkData={timelineSpark}
        />
        <WallboardMetricCard
          label="High Alerts"
          value={summary?.high ?? 0}
          color="#f97316"
          sparkData={timelineSpark}
        />
        <WallboardMetricCard
          label="Open Incidents"
          value={summary?.open_incidents ?? 0}
          color="#eab308"
        />
        <WallboardMetricCard
          label="Endpoints Online"
          value={summary?.online_agents ?? 0}
          color="#22c55e"
        />
        <WallboardMetricCard
          label="Endpoints Offline"
          value={summary?.offline_agents ?? 0}
          color="#ef4444"
        />
        <WallboardMetricCard
          label="Quarantined"
          value={containedCount}
          color="#a855f7"
        />
      </Box>
    </WallboardPanel>
  );
}

interface TopAssetsProps {
  assets: TopAsset[];
}

export function WallboardTopAssets({ assets }: TopAssetsProps) {
  const max = assets[0]?.alert_count || 1;

  return (
    <WallboardPanel title="Top Affected Assets" accent="#f97316">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {assets.length === 0 ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
            No affected assets
          </Typography>
        ) : (
          assets.slice(0, 6).map((asset) => (
            <Box key={asset.hostname} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  color: '#f1f5f9',
                  minWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                }}
              >
                {asset.hostname}
              </Typography>
              <Box sx={{ flex: 1, height: 8, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                <Box
                  sx={{
                    width: `${(asset.alert_count / max) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ea580c, #f97316)',
                    borderRadius: 1,
                  }}
                />
              </Box>
              <Typography
                sx={{ fontSize: '0.65rem', color: '#f97316', fontFamily: 'monospace', minWidth: 24 }}
              >
                {asset.alert_count}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </WallboardPanel>
  );
}

interface SeverityDonutProps {
  summary: DashboardSummary | undefined;
}

export function WallboardSeverityDonut({ summary }: SeverityDonutProps) {
  const data = [
    { name: 'Critical', value: summary?.critical ?? 0, color: SEV_COLORS.CRITICAL },
    { name: 'High', value: summary?.high ?? 0, color: SEV_COLORS.HIGH },
    { name: 'Medium', value: summary?.medium ?? 0, color: SEV_COLORS.MEDIUM },
    { name: 'Low', value: summary?.low ?? 0, color: SEV_COLORS.LOW },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <WallboardPanel title="Severity Distribution" accent="#22c55e">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 100, height: 100 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.length ? data : [{ name: 'None', value: 1, color: '#334155' }]}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={45}
                dataKey="value"
                stroke="none"
              >
                {(data.length ? data : [{ color: '#334155' }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ flex: 1 }}>
          {[
            { label: 'Critical', value: summary?.critical ?? 0, color: SEV_COLORS.CRITICAL },
            { label: 'High', value: summary?.high ?? 0, color: SEV_COLORS.HIGH },
            { label: 'Medium', value: summary?.medium ?? 0, color: SEV_COLORS.MEDIUM },
            { label: 'Low', value: summary?.low ?? 0, color: SEV_COLORS.LOW },
          ].map((item) => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', flex: 1 }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: item.color, fontFamily: 'monospace', fontWeight: 700 }}>
                {total > 0 ? Math.round((item.value / total) * 100) : 0}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </WallboardPanel>
  );
}

interface ActiveAlertsProps {
  count: number;
}

export function WallboardActiveAlerts({ count }: ActiveAlertsProps) {
  return (
    <Box
      sx={{
        p: 1.5,
        background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(127,29,29,0.3) 100%)',
        border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: '4px',
        textAlign: 'center',
        boxShadow: '0 0 20px rgba(239,68,68,0.2)',
        animation: count > 0 ? 'alert-pulse 2s ease-in-out infinite' : 'none',
        '@keyframes alert-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(239,68,68,0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(239,68,68,0.5)' },
        },
      }}
    >
      <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>
        {count}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: '#fca5a5',
          textTransform: 'uppercase',
        }}
      >
        Active Alerts
      </Typography>
      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
        Last 15 minutes
      </Typography>
    </Box>
  );
}
