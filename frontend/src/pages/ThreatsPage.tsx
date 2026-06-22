import { useState } from 'react';
import { Box, Grid, List, ListItem, ListItemText, Typography, Button, Chip, Stack } from '@mui/material';
import { BugReport, Warning, FilterAlt } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { threatsApi } from '../services/endpoints';
import { SeverityChip } from '../components/SeverityChip';
import { SeverityPieChart } from '../components/Charts';
import { PageHeader } from '../components/ui/PageHeader';
import { SyncRefreshButton } from '../components/SyncRefreshButton';
import { StatCard } from '../components/ui/StatCard';
import { GlassPanel } from '../components/ui/GlassPanel';
import { EmptyState } from '../components/ui/EmptyState';
import { getClassificationColor } from '../utils/classificationColors';

export function ThreatsPage() {
  const [severityFilter, setSeverityFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['threats', severityFilter],
    queryFn: () =>
      threatsApi.list(severityFilter ? { severity: severityFilter } : {}).then((r) => r.data),
    refetchInterval: 60000,
  });

  const severityData = data?.severity_distribution
    ? Object.entries(data.severity_distribution)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value)
    : [];

  const threats = data?.threats || [];
  const topTypes = severityData.slice(0, 3);

  const toggleSeverity = (name: string) => {
    setSeverityFilter((current) => (current === name ? '' : name));
  };

  return (
    <Box>
      <PageHeader
        title="Threat Intelligence"
        subtitle="Active threats detected by SentinelOne — click a type to filter"
        gradient="linear-gradient(90deg, #f1f5f9, #ef4444)"
        action={<SyncRefreshButton />}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${Math.min(topTypes.length + 1, 4)}, 1fr)` },
          gap: 2,
          mb: 2.5,
        }}
      >
        <StatCard
          label="All Threats"
          value={data?.total ?? threats.length}
          color="#ef4444"
          icon={<BugReport />}
          active={!severityFilter}
          onClick={() => setSeverityFilter('')}
        />
        {topTypes.map((item) => (
          <StatCard
            key={item.name}
            label={item.name.replace(/_/g, ' ')}
            value={item.value}
            color={getClassificationColor(item.name)}
            icon={<Warning />}
            active={severityFilter === item.name}
            onClick={() => toggleSeverity(item.name)}
          />
        ))}
        {severityData.length > 3 && (
          <StatCard
            label="Threat Types"
            value={severityData.length}
            color="#3b82f6"
            icon={<FilterAlt />}
            onClick={() => setSeverityFilter('')}
          />
        )}
      </Box>

      {severityFilter && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
          <Chip
            label={`Filtered: ${severityFilter.replace(/_/g, ' ')}`}
            onDelete={() => setSeverityFilter('')}
            sx={{
              bgcolor: `${getClassificationColor(severityFilter)}22`,
              color: getClassificationColor(severityFilter),
              fontWeight: 600,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {data?.filtered_total ?? threats.length} shown · click chart or card to change
          </Typography>
          <Button size="small" onClick={() => setSeverityFilter('')}>Clear</Button>
        </Stack>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <GlassPanel title="Threat Classification" accent="#f97316" noPadding>
            {severityData.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                No classification data
              </Typography>
            ) : (
              <Box sx={{ p: 1 }}>
                <SeverityPieChart
                  data={severityData}
                  title=""
                  bare
                  activeSegment={severityFilter}
                  onSegmentClick={toggleSeverity}
                />
              </Box>
            )}
          </GlassPanel>
        </Grid>
        <Grid item xs={12} md={8}>
          <GlassPanel title="Active Threats" accent="#ef4444">
            {isLoading ? (
              <Typography color="text.secondary">Loading...</Typography>
            ) : threats.length === 0 ? (
              <EmptyState icon={<BugReport />} message="No threats match this filter" />
            ) : (
              <List dense>
                {threats.map((t: {
                  id: string; title: string; severity: string;
                  hostname?: string; status: string; created_at: string;
                }) => (
                  <ListItem
                    key={t.id}
                    sx={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      px: 0,
                      cursor: 'pointer',
                      bgcolor: severityFilter === t.severity ? 'rgba(59,130,246,0.08)' : 'transparent',
                    }}
                    onClick={() => toggleSeverity(t.severity)}
                  >
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
