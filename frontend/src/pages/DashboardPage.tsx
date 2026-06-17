import { Grid, Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import {
  Warning, ErrorOutline, Info, CheckCircle, Report, FiberNew,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  SeverityPieChart, AlertsTimelineChart, MitreHeatmap,
  AnalystWorkloadChart, IncidentStatusChart,
} from '../components/Charts';
import { SeverityChip } from '../components/SeverityChip';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { GlassPanel } from '../components/ui/GlassPanel';
import { dashboardApi } from '../services/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';

export function DashboardPage() {
  const queryClient = useQueryClient();
  useWebSocket('dashboard', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));

  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
    refetchInterval: 30000,
  });
  const { data: timeline } = useQuery({
    queryKey: ['dashboard', 'timeline'],
    queryFn: () => dashboardApi.timeline().then((r) => r.data),
    refetchInterval: 60000,
  });
  const { data: heatmap } = useQuery({
    queryKey: ['dashboard', 'heatmap'],
    queryFn: () => dashboardApi.heatmap().then((r) => r.data),
    refetchInterval: 60000,
  });
  const { data: threats } = useQuery({
    queryKey: ['dashboard', 'threats'],
    queryFn: () => dashboardApi.threats(10).then((r) => r.data),
    refetchInterval: 30000,
  });
  const { data: workload } = useQuery({
    queryKey: ['dashboard', 'workload'],
    queryFn: () => dashboardApi.analystWorkload().then((r) => r.data),
  });
  const { data: incidentDist } = useQuery({
    queryKey: ['dashboard', 'incident-dist'],
    queryFn: () => dashboardApi.incidentDistribution().then((r) => r.data),
  });

  const severityData = summary
    ? [
        { name: 'CRITICAL', value: summary.critical },
        { name: 'HIGH', value: summary.high },
        { name: 'MEDIUM', value: summary.medium },
        { name: 'LOW', value: summary.low },
      ].filter((d) => d.value > 0)
    : [];
  const incidentData = incidentDist
    ? Object.entries(incidentDist).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <Box>
      <PageHeader
        title="Security Operations"
        subtitle="Real-time threat monitoring and alert triage"
        gradient="linear-gradient(90deg, #f1f5f9, #3b82f6, #a855f7)"
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Critical" value={summary?.critical ?? 0} color="#ef4444" icon={<ErrorOutline />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="High" value={summary?.high ?? 0} color="#f97316" icon={<Warning />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Medium" value={summary?.medium ?? 0} color="#eab308" icon={<Info />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Low" value={summary?.low ?? 0} color="#22c55e" icon={<CheckCircle />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Open Incidents" value={summary?.open_incidents ?? 0} color="#a855f7" icon={<Report />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="New Alerts" value={summary?.new_alerts ?? 0} color="#3b82f6" icon={<FiberNew />} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <GlassPanel title="Alerts Timeline" accent="#3b82f6" noPadding>
            <AlertsTimelineChart data={timeline || []} title="" />
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={4}>
          <GlassPanel title="Severity Distribution" accent="#f97316" noPadding>
            <SeverityPieChart data={severityData} title="" />
          </GlassPanel>
        </Grid>
        <Grid item xs={12}>
          <GlassPanel title="MITRE ATT&CK Heatmap" accent="#ef4444" noPadding>
            <MitreHeatmap data={heatmap || []} />
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={4}>
          <GlassPanel title="Live Threat Feed" accent="#ef4444">
            <List dense>
              {(threats || []).map((t) => (
                <ListItem key={t.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', px: 0 }}>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={600}>{t.title}</Typography>}
                    secondary={`${t.hostname || 'Unknown'} · ${formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}`}
                  />
                  <SeverityChip severity={t.severity} />
                </ListItem>
              ))}
              {(!threats || threats.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No active threats</Typography>
              )}
            </List>
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={4}>
          <GlassPanel title="Analyst Workload" accent="#06b6d4" noPadding>
            <AnalystWorkloadChart data={(workload || []).map((w: { name: string; alert_count: number }) => w)} />
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={4}>
          <GlassPanel title="Incident Status" accent="#a855f7" noPadding>
            <IncidentStatusChart data={incidentData} />
          </GlassPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
