import { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, Stack, Pagination,
  Drawer, IconButton, Divider, List, ListItem, ListItemText,
} from '@mui/material';
import { Add, Close, Report, FiberNew, Search } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { incidentsApi, usersApi } from '../services/endpoints';
import { SeverityChip, StatusChip } from '../components/SeverityChip';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { fieldSx } from '../components/ui/GlassPanel';
import { StyledTable } from '../components/ui/StyledTable';
import { EmptyState } from '../components/ui/EmptyState';
import { sanitizeInput } from '../utils/sanitize';
import type { Incident } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';

const INCIDENT_STATUSES = ['OPEN', 'INVESTIGATING', 'ESCALATED', 'CONTAINED', 'RESOLVED', 'CLOSED'];

export function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [form, setForm] = useState({ title: '', description: '', severity: 'HIGH' });
  const queryClient = useQueryClient();

  useWebSocket('incidents', () => queryClient.invalidateQueries({ queryKey: ['incidents'] }));

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', page],
    queryFn: () => incidentsApi.list({ page, page_size: 25 }).then((r) => r.data),
  });

  const { data: analysts } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => incidentsApi.create({
      title: sanitizeInput(form.title, 255),
      description: sanitizeInput(form.description, 5000),
      severity: form.severity,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setCreateOpen(false);
      setForm({ title: '', description: '', severity: 'HIGH' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Incident> }) =>
      incidentsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const openCount = data?.items?.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.status)).length ?? 0;
  const criticalCount = data?.items?.filter((i) => i.severity === 'CRITICAL').length ?? 0;

  return (
    <Box>
      <PageHeader
        title="Incident Management"
        subtitle="Track, assign, and resolve security incidents"
        gradient="linear-gradient(90deg, #f1f5f9, #a855f7)"
        action={
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            Create Incident
          </Button>
        }
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatCard label="Total Incidents" value={data?.total ?? 0} color="#a855f7" icon={<Report />} />
        <StatCard label="Open (page)" value={openCount} color="#f97316" icon={<FiberNew />} />
        <StatCard label="Critical (page)" value={criticalCount} color="#ef4444" icon={<Search />} />
      </Box>

      {isLoading ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading incidents...</Typography>
      ) : data?.items?.length === 0 ? (
        <EmptyState icon={<Report />} message="No incidents recorded" />
      ) : (
        <StyledTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Number', 'Title', 'Severity', 'Status', 'Created'].map((h) => (
                  <TableCell key={h}>{h.toUpperCase()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items?.map((inc) => (
                <TableRow key={inc.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(inc)}>
                  <TableCell><Chip label={inc.incident_number} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{inc.title}</TableCell>
                  <TableCell><SeverityChip severity={inc.severity} /></TableCell>
                  <TableCell><StatusChip status={inc.status} /></TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {format(new Date(inc.created_at), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTable>
      )}

      {data && data.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination count={data.pages} page={page} onChange={(_, p) => setPage(p)} color="primary" shape="rounded" />
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1117', border: '1px solid rgba(59,130,246,0.2)' } }}>
        <DialogTitle>Create Incident</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={form.title}
            onChange={(e) => setForm({ ...form, title: sanitizeInput(e.target.value, 255) })}
            margin="normal" sx={fieldSx} />
          <TextField fullWidth label="Description" multiline rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: sanitizeInput(e.target.value, 5000) })}
            margin="normal" sx={fieldSx} />
          <FormControl fullWidth margin="normal" sx={fieldSx}>
            <InputLabel>Severity</InputLabel>
            <Select value={form.severity} label="Severity"
              onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()} disabled={!form.title}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)}
        PaperProps={{ sx: { width: 520, p: 3, bgcolor: '#0d1117' } }}>
        {detail && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>{detail.incident_number}</Typography>
              <IconButton onClick={() => setDetail(null)}><Close /></IconButton>
            </Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <SeverityChip severity={detail.severity} size="medium" />
              <StatusChip status={detail.status} size="medium" />
            </Stack>
            <Typography variant="subtitle1" fontWeight={600}>{detail.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {detail.description}
            </Typography>
            <FormControl fullWidth size="small" sx={{ ...fieldSx, mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={detail.status}
                onChange={(e) => {
                  updateMutation.mutate({ id: detail.id, data: { status: e.target.value } });
                  setDetail({ ...detail, status: e.target.value });
                }}>
                {INCIDENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ ...fieldSx, mb: 2 }}>
              <InputLabel>Assign Analyst</InputLabel>
              <Select label="Assign Analyst" value={detail.assigned_analyst || ''}
                onChange={(e) => {
                  updateMutation.mutate({ id: detail.id, data: { assigned_analyst: e.target.value } });
                  setDetail({ ...detail, assigned_analyst: e.target.value });
                }}>
                <MenuItem value="">Unassigned</MenuItem>
                {(analysts || []).map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Timeline</Typography>
            <List dense>
              {(detail.timeline || []).map((entry, i) => (
                <ListItem key={i} sx={{ px: 0 }}>
                  <ListItemText
                    primary={entry.action}
                    secondary={`${entry.details || ''} · ${format(new Date(entry.timestamp), 'MMM d HH:mm')}`}
                  />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Case Notes</Typography>
            <TextField fullWidth multiline rows={4} defaultValue={detail.notes || ''} sx={fieldSx}
              onBlur={(e) => updateMutation.mutate({
                id: detail.id,
                data: { notes: sanitizeInput(e.target.value, 5000) },
              })}
            />
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
