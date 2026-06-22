import {
  Box, Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, Button, Typography, Chip,
} from '@mui/material';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassPanel } from './ui/GlassPanel';
import { StyledTable } from './ui/StyledTable';
import { PERMISSION_LEVELS } from '../constants/rbac';
import { rbacApi } from '../services/endpoints';

export function RolePermissionsMatrix() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['rbac', 'matrix'],
    queryFn: () => rbacApi.get().then((r) => r.data),
  });

  const [draft, setDraft] = useState<Record<string, Record<string, string>> | null>(null);
  const matrix = draft ?? data?.permissions ?? {};

  const saveMutation = useMutation({
    mutationFn: () => rbacApi.save(matrix).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac'] });
      setDraft(null);
    },
  });

  const setLevel = (role: string, module: string, level: string) => {
    setDraft((prev) => ({
      ...(data?.permissions ?? {}),
      ...prev,
      [role]: { ...(prev?.[role] ?? data?.permissions?.[role] ?? {}), [module]: level },
    }));
  };

  if (isLoading || !data) {
    return <Typography color="text.secondary">Loading role permissions...</Typography>;
  }

  return (
    <GlassPanel title="Module Access by Role" accent="#a855f7">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure which roles can view, edit, or manage each module. Changes apply immediately for all users with that role.
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <StyledTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>MODULE</TableCell>
                {data.roles.map((role) => (
                  <TableCell key={role} align="center">{role}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.modules.map((mod) => (
                <TableRow key={mod.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{mod.label}</TableCell>
                  {data.roles.map((role) => (
                    <TableCell key={`${role}-${mod.id}`} align="center">
                      <Select
                        size="small"
                        value={matrix[role]?.[mod.id] ?? 'none'}
                        onChange={(e) => setLevel(role, mod.id, e.target.value)}
                        sx={{ minWidth: 110, fontSize: '0.8rem' }}
                      >
                        {PERMISSION_LEVELS.map((lvl) => (
                          <MenuItem key={lvl.value} value={lvl.value}>{lvl.label}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTable>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
        <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!draft || saveMutation.isPending}>
          Save Permissions
        </Button>
        {draft && (
          <Button variant="text" onClick={() => setDraft(null)}>Reset</Button>
        )}
        <Chip label="Legend: View = read-only · Edit = triage/actions · Manage = full admin" size="small" />
      </Box>
    </GlassPanel>
  );
}
