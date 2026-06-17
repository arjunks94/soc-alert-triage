import { Grid, Typography, Box, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { SeverityKPICard } from '../components/KPICard';
import {
  SeverityPieChart, AlertsTimelineChart, MitreHeatmap,
  AnalystWorkloadChart, IncidentStatusChart,
} from '../components/Charts';
import { SeverityChip } from '../components/SeverityChip';
import { dashboardApi } from '../services/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';

export function DashboardPage() {
  const queryClient = useQueryClient();

  useWebSocket('dashboard', () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  });

  const { data: summary, isLoading } = useQuery({
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
      <Typography variant="h4" fontWeight={700} gutterBottom>Security Operations Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Real-time threat monitoring and alert triage
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <SeverityKPICard title="Critical" value={summary?.critical ?? 0} severity="CRITICAL" loading={isLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <SeverityKPICard title="High" value={summary?.high ?? 0} severity="HIGH" loading={isLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <SeverityKPICard title="Medium" value={summary?.medium ?? 0} severity="MEDIUM" loading={isLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <SeverityKPICard title="Low" value={summary?.low ?? 0} severity="LOW" loading={isLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <SeverityKPICard title="Open Incidents" value={summary?.open_incidents ?? 0} severity="HIGH" loading={isLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <SeverityKPICard title="New Alerts" value={summary?.new_alerts ?? 0} severity="MEDIUM" loading={isLoading} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <AlertsTimelineChart data={timeline || []} />
        </Grid>
        <Grid item xs={12} md={4}>
          <SeverityPieChart data={severityData} />
        </Grid>
        <Grid item xs={12}>
          <MitreHeatmap data={heatmap || []} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Live Threat Feed</Typography>
              <List dense>
                {(threats || []).map((t) => (
                  <ListItem key={t.id} divider>
                    <ListItemText
                      primary={t.title}
                      secondary={`${t.hostname || 'Unknown'} · ${formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}`}
                    />
                    <SeverityChip severity={t.severity} />
                  </ListItem>
                ))}
                {(!threats || threats.length === 0) && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    No active high-severity threats
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <AnalystWorkloadChart data={(workload || []).map((w: { name: string; alert_count: number }) => w)} />
        </Grid>
        <Grid item xs={12} md={4}>
          <IncidentStatusChart data={incidentData} />
        </Grid>
      </Grid>
    </Box>
  );
}
