import { Box, Typography, Grid, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { threatsApi } from '../services/endpoints';
import { SeverityChip } from '../components/SeverityChip';
import { SeverityPieChart } from '../components/Charts';

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

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Threat Intelligence</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Active threats detected by SentinelOne
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <SeverityPieChart data={severityData} title="Threat Severity Distribution" />
        </Grid>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Active Threats</Typography>
              {isLoading ? (
                <Typography>Loading...</Typography>
              ) : (
                <List>
                  {(data?.threats || []).map((t: {
                    id: string; title: string; severity: string;
                    hostname?: string; status: string; created_at: string;
                  }) => (
                    <ListItem key={t.id} divider>
                      <ListItemText
                        primary={t.title}
                        secondary={`${t.hostname || 'Unknown'} · ${t.status} · ${formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}`}
                      />
                      <SeverityChip severity={t.severity} />
                    </ListItem>
                  ))}
                  {(!data?.threats || data.threats.length === 0) && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No active threats
                    </Typography>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
