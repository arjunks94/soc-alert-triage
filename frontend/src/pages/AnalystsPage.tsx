import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Add, People, AdminPanelSettings } from '@mui/icons-material';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { usersApi, authApi } from '../services/endpoints';
import { useAuthStore } from '../stores/authStore';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { fieldSx } from '../components/ui/GlassPanel';
import { StyledTable } from '../components/ui/StyledTable';
import { sanitizeInput } from '../utils/sanitize';

const ROLES = ['SOC_ADMIN', 'SOC_MANAGER', 'SOC_ANALYST', 'VIEWER'];

export function AnalystsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SOC_ANALYST' });
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: analysts, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => authApi.register({
      name: sanitizeInput(form.name, 100),
      email: sanitizeInput(form.email, 255),
      password: form.password,
      role: form.role,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'SOC_ANALYST' });
    },
  });

  const isAdmin = user?.role === 'SOC_ADMIN';
  const analystCount = analysts?.filter((a) => a.role === 'SOC_ANALYST').length ?? 0;

  return (
    <Box>
      <PageHeader
        title="Analysts"
        subtitle="Manage SOC team members and roles"
        gradient="linear-gradient(90deg, #f1f5f9, #06b6d4)"
        action={isAdmin ? (
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            Add Analyst
          </Button>
        ) : undefined}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
        <StatCard label="Total Users" value={analysts?.length ?? 0} color="#06b6d4" icon={<People />} />
        <StatCard label="Analysts" value={analystCount} color="#3b82f6" icon={<People />} />
        <StatCard label="Admins" value={analysts?.filter((a) => a.role === 'SOC_ADMIN').length ?? 0} color="#a855f7" icon={<AdminPanelSettings />} />
      </Box>

      {isLoading ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading analysts...</Typography>
      ) : (
        <StyledTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Name', 'Email', 'Role', 'Status', 'Joined'].map((h) => (
                  <TableCell key={h}>{h.toUpperCase()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {analysts?.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{a.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.email}</TableCell>
                  <TableCell><Chip label={a.role} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip label={a.is_active ? 'Active' : 'Inactive'} size="small"
                      color={a.is_active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    {format(new Date(a.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTable>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1117', border: '1px solid rgba(59,130,246,0.2)' } }}>
        <DialogTitle>Add Analyst</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: sanitizeInput(e.target.value, 100) })}
            margin="normal" sx={fieldSx} />
          <TextField fullWidth label="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: sanitizeInput(e.target.value, 255) })}
            margin="normal" sx={fieldSx} />
          <TextField fullWidth label="Password" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            margin="normal" sx={fieldSx} />
          <FormControl fullWidth margin="normal" sx={fieldSx}>
            <InputLabel>Role</InputLabel>
            <Select value={form.role} label="Role"
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()}
            disabled={!form.name || !form.email || !form.password}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
