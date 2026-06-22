import { useState } from 'react';
import {
  Box, Pagination, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, Chip, Drawer, IconButton, Stack, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Close, Event, DesktopWindows, ListAlt } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { eventsApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { GlassPanel } from '../components/ui/GlassPanel';
import { StyledTable } from '../components/ui/StyledTable';
import { EmptyState } from '../components/ui/EmptyState';
import { SyncRefreshButton } from '../components/SyncRefreshButton';
import { useWebSocket } from '../hooks/useWebSocket';
import type { SecurityEvent } from '../types';

const CATEGORIES = [
  { value: '', label: 'All Events' },
  { value: 'remote_desktop', label: 'Remote Desktop' },
  { value: 'activity', label: 'Other Activities' },
] as const;

export function EventsPage() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [detailEvent, setDetailEvent] = useState<SecurityEvent | null>(null);
  const queryClient = useQueryClient();

  useWebSocket('events', () => queryClient.invalidateQueries({ queryKey: ['events'] }));

  const { data: stats } = useQuery({
    queryKey: ['events', 'stats'],
    queryFn: () => eventsApi.stats().then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['events', page, category],
    queryFn: () =>
      eventsApi.list({
        page,
        page_size: 25,
        ...(category && { category }),
      }).then((r) => r.data),
    refetchInterval: 60000,
  });

  return (
    <Box>
      <PageHeader
        title="Security Events"
        subtitle="SentinelOne activities including remote desktop and remote ops sessions"
        gradient="linear-gradient(90deg, #f1f5f9, #06b6d4)"
        action={<SyncRefreshButton />}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 2.5,
        }}
      >
        <StatCard label="Total Events" value={stats?.total ?? 0} color="#06b6d4" icon={<Event />} />
        <StatCard
          label="Remote Desktop"
          value={stats?.remote_desktop ?? 0}
          color="#a855f7"
          icon={<DesktopWindows />}
        />
        <StatCard label="Filtered Results" value={data?.total ?? 0} color="#3b82f6" icon={<ListAlt />} />
      </Box>

      <GlassPanel title="Event Categories" accent="#06b6d4" sx={{ mb: 2.5 }}>
        <ToggleButtonGroup
          size="small"
          value={category}
          exclusive
          onChange={(_, v) => { if (v !== null) { setCategory(v); setPage(1); } }}
        >
          {CATEGORIES.map((c) => (
            <ToggleButton key={c.value || 'all'} value={c.value}>
              {c.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </GlassPanel>

      {isLoading ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Loading events...
        </Typography>
      ) : data?.items?.length === 0 ? (
        <EmptyState
          icon={<Event />}
          message="No events found. Click Refresh from SentinelOne to fetch latest data."
        />
      ) : (
        <StyledTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Category', 'Type', 'Title', 'Hostname', 'User', 'Event Time'].map((h) => (
                  <TableCell key={h}>{h.toUpperCase()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items?.map((event: SecurityEvent) => (
                <TableRow
                  key={event.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setDetailEvent(event)}
                >
                  <TableCell>
                    <Chip
                      label={event.category === 'remote_desktop' ? 'Remote Desktop' : 'Activity'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: event.category === 'remote_desktop'
                          ? 'rgba(168,85,247,0.15)'
                          : 'rgba(6,182,212,0.15)',
                        color: event.category === 'remote_desktop' ? '#a855f7' : '#06b6d4',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{event.event_type}</TableCell>
                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {event.title}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {event.hostname || '-'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{event.user_name || '-'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {format(new Date(event.event_at), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTable>
      )}

      {data && data.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={data.pages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}

      <Drawer
        anchor="right"
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        PaperProps={{ sx: { width: 520, p: 3, bgcolor: '#0d1117' } }}
      >
        {detailEvent && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Event Details</Typography>
              <IconButton onClick={() => setDetailEvent(null)}><Close /></IconButton>
            </Box>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Typography variant="body2"><strong>Type:</strong> {detailEvent.event_type}</Typography>
              <Typography variant="body2"><strong>Category:</strong> {detailEvent.category}</Typography>
              <Typography variant="body2"><strong>Hostname:</strong> {detailEvent.hostname || '-'}</Typography>
              <Typography variant="body2"><strong>User:</strong> {detailEvent.user_name || '-'}</Typography>
              <Typography variant="body2"><strong>Site:</strong> {detailEvent.site_name || '-'}</Typography>
              <Typography variant="body2">
                <strong>Event Time:</strong> {format(new Date(detailEvent.event_at), 'PPpp')}
              </Typography>
            </Stack>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Description</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {detailEvent.description || detailEvent.title}
            </Typography>
            {detailEvent.raw_data && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>SentinelOne Response</Typography>
                <Box
                  component="pre"
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.3)',
                    p: 2,
                    borderRadius: 2,
                    overflow: 'auto',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    maxHeight: 400,
                    border: '1px solid rgba(59,130,246,0.15)',
                  }}
                >
                  {JSON.stringify(detailEvent.raw_data, null, 2)}
                </Box>
              </>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
