import { Box, Grid, List, ListItem, ListItemText, Typography } from '@mui/material';
import { BugReport, Warning, ErrorOutline } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { threatsApi } from '../services/endpoints';
import { SeverityChip } from '../components/SeverityChip';
import { SeverityPieChart } from '../components/Charts';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { GlassPanel } from '../components/ui/GlassPanel';
import { EmptyState } from '../components/ui/EmptyState';

export function ThreatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['threats'],
    queryFn: () => threatsApi.list().then((r) => r.data),
    refetchInterval: 60000,
  });

  const severityData = data?.severity_distribution
    ? Object.entries(data.severity_distribution).map(([name, value]) => ({
        name,
        value: value as number,
      }))
    : [];

  const threats = data?.threats || [];
  const criticalCount = threats.filter((t: { severity: string }) => t.severity === 'CRITICAL').length;

  return (
    <Box>
      <PageHeader
        title="Threat Intelligence"
        subtitle="Active threats detected by SentinelOne"
        gradient="linear-gradient(90deg, #f1f5f9, #ef4444)"
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatCard label="Active Threats" value={threats.length} color="#ef4444" icon={<BugReport />} />
        <StatCard label="Critical" value={criticalCount} color="#f97316" icon={<ErrorOutline />} />
        <StatCard
          label="Severity Types"
          value={severityData.length}
          color="#3b82f6"
          icon={<Warning />}
        />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <GlassPanel title="Severity Distribution" accent="#f97316" noPadding>
            <SeverityPieChart data={severityData} title="" />
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={8}>
          <GlassPanel title="Active Threats" accent="#ef4444">
            {isLoading ? (
              <Typography color="text.secondary">Loading...</Typography>
            ) : threats.length === 0 ? (
              <EmptyState icon={<BugReport />} message="No active threats" />
            ) : (
              <List dense>
                {threats.map((t: {
                  id: string; title: string; severity: string;
                  hostname?: string; status: string; created_at: string;
                }) => (
                  <ListItem key={t.id} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', px: 0 }}>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={600}>{t.title}</Typography>}
                      secondary={`${t.hostname || 'Unknown'} · ${t.status} · ${formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}`}
                    />
                    <SeverityChip severity={t.severity} />
                  </ListItem>
                ))}
              </List>
            )}
          </GlassPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
