import { useState } from 'react';
import {
  Box, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
  Checkbox, Button, Drawer, IconButton, Chip, Stack, Pagination, Divider,
  InputAdornment,
} from '@mui/material';
import { Close, Search, FilterAlt, Warning } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { alertsApi, usersApi } from '../services/endpoints';
import { SeverityChip, StatusChip } from '../components/SeverityChip';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { GlassPanel, fieldSx } from '../components/ui/GlassPanel';
import { StyledTable } from '../components/ui/StyledTable';
import { EmptyState } from '../components/ui/EmptyState';
import { sanitizeInput } from '../utils/sanitize';
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

  useWebSocket('alerts', () => queryClient.invalidateQueries({ queryKey: ['alerts'] }));

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', page, search, severity, status, analystId],
    queryFn: () =>
      alertsApi.list({
        page, page_size: 25,
        ...(search && { search: sanitizeInput(search, 200) }),
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
    mutationFn: ({ id, data: d }: { id: string; data: Partial<Alert> }) => alertsApi.update(id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }); setDetailAlert(null); },
  });
  const bulkMutation = useMutation({
    mutationFn: (params: { alert_ids: string[]; action: string; value?: string; analyst_id?: string }) =>
      alertsApi.bulk(params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['alerts'] }); setSelected([]); },
  });
  const incidentMutation = useMutation({
    mutationFn: (id: string) => alertsApi.createIncident(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });

  const criticalCount = data?.items?.filter((a) => a.severity === 'CRITICAL').length ?? 0;
  const openCount = data?.items?.filter((a) => !['CLOSED', 'FALSE_POSITIVE'].includes(a.status)).length ?? 0;

  return (
    <Box>
      <PageHeader title="Alert Triage" subtitle="Investigate, assign, and resolve security alerts" gradient="linear-gradient(90deg, #f1f5f9, #ef4444)" />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatCard label="Total Results" value={data?.total ?? 0} color="#3b82f6" icon={<FilterAlt />} />
        <StatCard label="Critical (page)" value={criticalCount} color="#ef4444" icon={<Warning />} />
        <StatCard label="Open (page)" value={openCount} color="#f97316" icon={<Search />} />
        <StatCard label="Selected" value={selected.length} color="#a855f7" icon={<FilterAlt />} />
      </Box>

      <GlassPanel title="Filters" accent="#ef4444" sx={{ mb: 2.5 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Search" value={search}
            onChange={(e) => { setSearch(sanitizeInput(e.target.value, 200)); setPage(1); }}
            sx={{ ...fieldSx, minWidth: 220 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ ...fieldSx, minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select value={severity} label="Severity" onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ ...fieldSx, minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ ...fieldSx, minWidth: 160 }}>
            <InputLabel>Analyst</InputLabel>
            <Select value={analystId} label="Analyst" onChange={(e) => { setAnalystId(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              {(analysts || []).map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </GlassPanel>

      {selected.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Chip label={`${selected.length} selected`} size="small" color="primary" />
          {STATUSES.slice(0, 4).map((s) => (
            <Button key={s} size="small" variant="outlined"
              onClick={() => bulkMutation.mutate({ alert_ids: selected, action: 'change_status', value: s })}>
              {s}
            </Button>
          ))}
          <Button size="small" variant="outlined" color="error"
            onClick={() => bulkMutation.mutate({ alert_ids: selected, action: 'escalate' })}>
            Escalate
          </Button>
        </Stack>
      )}

      {isLoading ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading alerts...</Typography>
      ) : data?.items?.length === 0 ? (
        <EmptyState icon={<Warning />} message="No alerts match your filters" />
      ) : (
        <StyledTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={!!data?.items?.length && selected.length === data.items.length}
                    onChange={() => setSelected(selected.length === (data?.items?.length ?? 0) ? [] : data!.items.map((a) => a.id))}
                  />
                </TableCell>
                {['Severity', 'Title', 'Hostname', 'Status', 'Created'].map((h) => (
                  <TableCell key={h}>{h.toUpperCase()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items?.map((alert) => (
                <TableRow key={alert.id} hover sx={{ cursor: 'pointer' }}
                  onClick={() => setDetailAlert(alert)} selected={selected.includes(alert.id)}>
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.includes(alert.id)}
                      onChange={() => setSelected((p) => p.includes(alert.id) ? p.filter((x) => x !== alert.id) : [...p, alert.id])} />
                  </TableCell>
                  <TableCell><SeverityChip severity={alert.severity} /></TableCell>
                  <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {alert.title}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{alert.hostname || '-'}</TableCell>
                  <TableCell><StatusChip status={alert.status} /></TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{format(new Date(alert.created_at), 'MMM d, HH:mm')}</TableCell>
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

      <Drawer anchor="right" open={!!detailAlert} onClose={() => setDetailAlert(null)} PaperProps={{ sx: { width: 480, p: 3, bgcolor: '#0d1117' } }}>
        {detailAlert && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Alert Details</Typography>
              <IconButton onClick={() => setDetailAlert(null)}><Close /></IconButton>
            </Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <SeverityChip severity={detailAlert.severity} size="medium" />
              <StatusChip status={detailAlert.status} size="medium" />
            </Stack>
            <Typography variant="subtitle1" fontWeight={600}>{detailAlert.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>{detailAlert.description || 'No description'}</Typography>
            <Divider sx={{ my: 2 }} />
            <FormControl fullWidth size="small" sx={{ ...fieldSx, mb: 2 }}>
              <InputLabel>Change Status</InputLabel>
              <Select label="Change Status" value={detailAlert.status}
                onChange={(e) => updateMutation.mutate({ id: detailAlert.id, data: { status: e.target.value } })}>
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={{ ...fieldSx, mb: 2 }}>
              <InputLabel>Assign Analyst</InputLabel>
              <Select label="Assign Analyst" value={detailAlert.assigned_analyst_id || ''}
                onChange={(e) => updateMutation.mutate({ id: detailAlert.id, data: { assigned_analyst_id: e.target.value } })}>
                <MenuItem value="">Unassigned</MenuItem>
                {(analysts || []).map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth multiline rows={3} label="Notes" defaultValue={detailAlert.notes || ''}
              onBlur={(e) => { if (e.target.value !== detailAlert.notes) updateMutation.mutate({ id: detailAlert.id, data: { notes: sanitizeInput(e.target.value, 5000) } }); }}
              sx={{ mb: 2, ...fieldSx }}
            />
            <Button variant="contained" color="error" fullWidth onClick={() => incidentMutation.mutate(detailAlert.id)}>
              Create Incident
            </Button>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
