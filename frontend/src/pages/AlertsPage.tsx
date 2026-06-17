import { useState } from 'react';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Checkbox, Button, Drawer, IconButton, Chip, Stack, Pagination,
  Divider,
} from '@mui/material';
import { Close, Search } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { alertsApi, usersApi } from '../services/endpoints';
import { SeverityChip, StatusChip } from '../components/SeverityChip';
import type { Alert } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';

const STATUSES = ['NEW', 'OPEN', 'INVESTIGATING', 'ESCALATED', 'CONTAINED', 'FALSE_POSITIVE', 'CLOSED'];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function AlertsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [analystId, setAnalystId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);
  const queryClient = useQueryClient();

  useWebSocket('alerts', () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  });

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', page, search, severity, status, analystId],
    queryFn: () =>
      alertsApi.list({
        page,
        page_size: 25,
        ...(search && { search }),
        ...(severity && { severity }),
        ...(status && { status }),
        ...(analystId && { analyst_id: analystId }),
      }).then((r) => r.data),
  });

  const { data: analysts } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Alert> }) =>
      alertsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setDetailAlert(null);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (params: { alert_ids: string[]; action: string; value?: string; analyst_id?: string }) =>
      alertsApi.bulk(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setSelected([]);
    },
  });

  const incidentMutation = useMutation({
    mutationFn: (id: string) => alertsApi.createIncident(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (!data?.items) return;
    setSelected(selected.length === data.items.length ? [] : data.items.map((a) => a.id));
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Alert Triage</Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          size="small" placeholder="Search alerts..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ minWidth: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Severity</InputLabel>
          <Select value={severity} label="Severity" onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Analyst</InputLabel>
          <Select value={analystId} label="Analyst" onChange={(e) => { setAnalystId(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {(analysts || []).map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {selected.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ alignSelf: 'center' }}>{selected.length} selected</Typography>
          {STATUSES.map((s) => (
            <Button key={s} size="small" variant="outlined"
              onClick={() => bulkMutation.mutate({ alert_ids: selected, action: 'change_status', value: s })}>
              Mark {s}
            </Button>
          ))}
          <Button size="small" variant="outlined" color="error"
            onClick={() => bulkMutation.mutate({ alert_ids: selected, action: 'escalate' })}>
            Escalate
          </Button>
        </Stack>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox checked={!!data?.items?.length && selected.length === data.items.length} onChange={toggleAll} />
              </TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} align="center">Loading...</TableCell></TableRow>
            ) : data?.items?.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No alerts found</TableCell></TableRow>
            ) : (
              data?.items?.map((alert) => (
                <TableRow key={alert.id} hover sx={{ cursor: 'pointer' }}
                  onClick={() => setDetailAlert(alert)} selected={selected.includes(alert.id)}>
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.includes(alert.id)} onChange={() => toggleSelect(alert.id)} />
                  </TableCell>
                  <TableCell><SeverityChip severity={alert.severity} /></TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.title}
                  </TableCell>
                  <TableCell>{alert.hostname || '-'}</TableCell>
                  <TableCell><StatusChip status={alert.status} /></TableCell>
                  <TableCell>{format(new Date(alert.created_at), 'MMM d, HH:mm')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={data.pages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Box>
      )}

      <Drawer anchor="right" open={!!detailAlert} onClose={() => setDetailAlert(null)}
        PaperProps={{ sx: { width: 480, p: 3 } }}>
        {detailAlert && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Alert Details</Typography>
              <IconButton onClick={() => setDetailAlert(null)}><Close /></IconButton>
            </Box>
            <Stack spacing={1} sx={{ mb: 2 }}>
              <SeverityChip severity={detailAlert.severity} size="medium" />
              <StatusChip status={detailAlert.status} size="medium" />
            </Stack>
            <Typography variant="subtitle1" fontWeight={600}>{detailAlert.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {detailAlert.description || 'No description'}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2"><strong>Hostname:</strong> {detailAlert.hostname || 'N/A'}</Typography>
            <Typography variant="body2"><strong>Site:</strong> {detailAlert.site_name || 'N/A'}</Typography>
            <Typography variant="body2"><strong>Agent ID:</strong> {detailAlert.agent_id || 'N/A'}</Typography>
            <Typography variant="body2"><strong>S1 Alert ID:</strong> {detailAlert.sentinel_alert_id}</Typography>
            {detailAlert.mitre_tactics?.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>MITRE Tactics:</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {detailAlert.mitre_tactics.map((t) => <Chip key={t} label={t} size="small" />)}
                </Stack>
              </Box>
            )}
            <Divider sx={{ my: 2 }} />
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Change Status</InputLabel>
              <Select label="Change Status" value={detailAlert.status}
                onChange={(e) => updateMutation.mutate({ id: detailAlert.id, data: { status: e.target.value } })}>
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Assign Analyst</InputLabel>
              <Select label="Assign Analyst" value={detailAlert.assigned_analyst_id || ''}
                onChange={(e) => updateMutation.mutate({ id: detailAlert.id, data: { assigned_analyst_id: e.target.value } })}>
                <MenuItem value="">Unassigned</MenuItem>
                {(analysts || []).map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth multiline rows={3} label="Notes" defaultValue={detailAlert.notes || ''}
              onBlur={(e) => {
                if (e.target.value !== detailAlert.notes) {
                  updateMutation.mutate({ id: detailAlert.id, data: { notes: e.target.value } });
                }
              }}
              sx={{ mb: 2 }}
            />
            <Button variant="contained" color="error" fullWidth
              onClick={() => incidentMutation.mutate(detailAlert.id)}>
              Create Incident
            </Button>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
