import { useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Pagination, FormControlLabel, Switch,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { endpointsApi } from '../services/endpoints';

export function EndpointsPage() {
  const [page, setPage] = useState(1);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['endpoints', page, onlineOnly],
    queryFn: () =>
      endpointsApi.list({ page, page_size: 50, ...(onlineOnly && { online_only: true }) }).then((r) => r.data),
    refetchInterval: 60000,
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Endpoints</Typography>
        <FormControlLabel
          control={<Switch checked={onlineOnly} onChange={(e) => { setOnlineOnly(e.target.checked); setPage(1); }} />}
          label="Online only"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Hostname</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>OS</TableCell>
              <TableCell>Group</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Last Seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} align="center">Loading...</TableCell></TableRow>
            ) : data?.items?.length === 0 ? (
              <TableRow><TableCell colSpan={7} align="center">No endpoints found</TableCell></TableRow>
            ) : (
              data?.items?.map((ep) => (
                <TableRow key={ep.id} hover>
                  <TableCell>
                    <Chip
                      label={ep.is_online ? 'Online' : 'Offline'}
                      size="small"
                      color={ep.is_online ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{ep.hostname || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{ep.ip_address || '-'}</TableCell>
                  <TableCell>{ep.os_name} {ep.os_version}</TableCell>
                  <TableCell>{ep.group_name || '-'}</TableCell>
                  <TableCell>{ep.site_name || '-'}</TableCell>
                  <TableCell>
                    {ep.last_seen ? format(new Date(ep.last_seen), 'MMM d, HH:mm') : '-'}
                  </TableCell>
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
    </Box>
  );
}
