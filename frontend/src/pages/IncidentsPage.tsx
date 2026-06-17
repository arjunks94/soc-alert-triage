import { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, Stack, Pagination,
  Drawer, IconButton, Divider, List, ListItem, ListItemText,
} from '@mui/material';
import { Add, Close } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { incidentsApi, usersApi } from '../services/endpoints';
import { SeverityChip, StatusChip } from '../components/SeverityChip';
import type { Incident } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';

const INCIDENT_STATUSES = ['OPEN', 'INVESTIGATING', 'ESCALATED', 'CONTAINED', 'RESOLVED', 'CLOSED'];

export function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [form, setForm] = useState({ title: '', description: '', severity: 'HIGH' });
  const queryClient = useQueryClient();

  useWebSocket('incidents', () => {
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  });

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', page],
    queryFn: () => incidentsApi.list({ page, page_size: 25 }).then((r) => r.data),
  });

  const { data: analysts } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => incidentsApi.create(form),
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Incident Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Create Incident
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : data?.items?.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No incidents</TableCell></TableRow>
            ) : (
              data?.items?.map((inc) => (
                <TableRow key={inc.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(inc)}>
                  <TableCell><Chip label={inc.incident_number} size="small" variant="outlined" /></TableCell>
                  <TableCell>{inc.title}</TableCell>
                  <TableCell><SeverityChip severity={inc.severity} /></TableCell>
                  <TableCell><StatusChip status={inc.status} /></TableCell>
                  <TableCell>{format(new Date(inc.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={data.pages} page={page} onChange={(_, p) => setPage(p)} />
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Incident</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} margin="normal" />
          <TextField fullWidth label="Description" multiline rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Severity</InputLabel>
            <Select value={form.severity} label="Severity"
              onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()} disabled={!form.title}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)}
        PaperProps={{ sx: { width: 520, p: 3 } }}>
        {detail && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{detail.incident_number}</Typography>
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
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={detail.status}
                onChange={(e) => {
                  updateMutation.mutate({ id: detail.id, data: { status: e.target.value } });
                  setDetail({ ...detail, status: e.target.value });
                }}>
                {INCIDENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
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
                <ListItem key={i}>
                  <ListItemText
                    primary={entry.action}
                    secondary={`${entry.details || ''} · ${format(new Date(entry.timestamp), 'MMM d HH:mm')}`}
                  />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Case Notes</Typography>
            <TextField fullWidth multiline rows={4} defaultValue={detail.notes || ''}
              onBlur={(e) => updateMutation.mutate({ id: detail.id, data: { notes: e.target.value } })}
            />
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
