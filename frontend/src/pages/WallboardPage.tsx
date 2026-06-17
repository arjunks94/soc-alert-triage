import { Box, Grid, Typography, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Security, Warning, Computer } from '@mui/icons-material';
import { SeverityKPICard } from '../components/KPICard';
import { AlertsTimelineChart, MitreHeatmap } from '../components/Charts';
import { SeverityChip } from '../components/SeverityChip';
import { dashboardApi } from '../services/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';

export function WallboardPage() {
  const queryClient = useQueryClient();

  useWebSocket('dashboard', () => {
    queryClient.invalidateQueries({ queryKey: ['wallboard'] });
  });

  const { data: summary } = useQuery({
    queryKey: ['wallboard', 'summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: threats } = useQuery({
    queryKey: ['wallboard', 'threats'],
    queryFn: () => dashboardApi.threats(15).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: timeline } = useQuery({
    queryKey: ['wallboard', 'timeline'],
    queryFn: () => dashboardApi.timeline(12).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: heatmap } = useQuery({
    queryKey: ['wallboard', 'heatmap'],
    queryFn: () => dashboardApi.heatmap().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: topAssets } = useQuery({
    queryKey: ['wallboard', 'top-assets'],
    queryFn: () => dashboardApi.topAssets(8).then((r) => r.data),
    refetchInterval: 15000,
  });

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#0a0e17', p: 3,
      background: 'radial-gradient(ellipse at top, #111827 0%, #0a0e17 70%)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Security sx={{ fontSize: 40, color: '#00bcd4', mr: 2 }} />
        <Box>
          <Typography variant="h3" fontWeight={800} sx={{ color: '#fff', letterSpacing: 2 }}>
            SOC WALLBOARD
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Security Operations Center · Live Monitoring
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
          <Typography variant="h5" sx={{ color: '#00bcd4', fontFamily: 'monospace' }}>
            {new Date().toLocaleTimeString()}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Auto-refresh: 15s
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={2.4}>
          <SeverityKPICard title="Critical Alerts" value={summary?.critical ?? 0}
            severity="CRITICAL" large />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <SeverityKPICard title="High Alerts" value={summary?.high ?? 0}
            severity="HIGH" large />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <SeverityKPICard title="Open Incidents" value={summary?.open_incidents ?? 0}
            severity="HIGH" large />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <SeverityKPICard title="Endpoints Online" value={summary?.online_agents ?? 0}
            severity="LOW" large />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <SeverityKPICard title="Endpoints Offline" value={summary?.offline_agents ?? 0}
            severity="CRITICAL" large />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card sx={{ bgcolor: '#111827', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: '#ef4444', mr: 1 }} />
                <Typography variant="h5" fontWeight={700}>Live Threat Feed</Typography>
              </Box>
              <List>
                {(threats || []).map((t) => (
                  <ListItem key={t.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', py: 1.5 }}>
                    <ListItemText
                      primary={<Typography variant="body1" fontWeight={500}>{t.title}</Typography>}
                      secondary={
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          {t.hostname || 'Unknown'} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                        </Typography>
                      }
                    />
                    <SeverityChip severity={t.severity} size="medium" />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <AlertsTimelineChart data={timeline || []} title="Threat Timeline (12h)" />
        </Grid>
        <Grid item xs={12} md={8}>
          <MitreHeatmap data={heatmap || []} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: '#111827', height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Computer sx={{ color: '#00bcd4', mr: 1 }} />
                <Typography variant="h5" fontWeight={700}>Top Affected Assets</Typography>
              </Box>
              <List>
                {(topAssets || []).map((asset, i) => (
                  <ListItem key={asset.hostname} sx={{ py: 1 }}>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.3)', mr: 2, minWidth: 24 }}>
                      {i + 1}
                    </Typography>
                    <ListItemText
                      primary={asset.hostname}
                      secondary={`${asset.alert_count} alerts`}
                    />
                    <SeverityChip severity={asset.severity_max} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
