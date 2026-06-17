import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { usersApi, authApi } from '../services/endpoints';
import { useAuthStore } from '../stores/authStore';

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
    mutationFn: () => authApi.register(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setForm({ name: '', email: '', password: '', role: 'SOC_ANALYST' });
    },
  });

  const isAdmin = user?.role === 'SOC_ADMIN';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Analysts</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            Add Analyst
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Joined</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : (
              analysts?.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell><Chip label={a.role} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Chip label={a.is_active ? 'Active' : 'Inactive'} size="small"
                      color={a.is_active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell>{format(new Date(a.created_at), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Analyst</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Password" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select value={form.role} label="Role"
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
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
