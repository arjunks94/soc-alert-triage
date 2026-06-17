import { useState, useMemo } from 'react';
import {
  Box, Pagination, Skeleton, ToggleButton, ToggleButtonGroup,
  Chip, InputAdornment, TextField,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import {
  ViewModule, ViewList, Computer, Wifi, WifiOff, Search,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { endpointsApi } from '../services/endpoints';
import {
  EndpointFilterBar, emptyFilters, buildFilterParams, type EndpointFilters,
} from '../components/endpoints/EndpointFilters';
import { EndpointCard } from '../components/endpoints/EndpointCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StyledTable } from '../components/ui/StyledTable';
import { EmptyState } from '../components/ui/EmptyState';
import { fieldSx } from '../components/ui/GlassPanel';
import { sanitizeInput } from '../utils/sanitize';

export function EndpointsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EndpointFilters>(emptyFilters);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [quickSearch, setQuickSearch] = useState('');

  const mergedFilters = useMemo(() => ({
    ...filters,
    hostname: quickSearch || filters.hostname,
  }), [filters, quickSearch]);

  const filterParams = buildFilterParams(mergedFilters, page);

  const { data: filterOptions } = useQuery({
    queryKey: ['endpoints', 'filters'],
    queryFn: () => endpointsApi.filters().then((r) => r.data),
    staleTime: 60000,
  });

  const { data: stats } = useQuery({
    queryKey: ['endpoints', 'stats', mergedFilters],
    queryFn: () => {
      const p: Record<string, string | boolean> = {};
      if (mergedFilters.hostname) p.hostname = mergedFilters.hostname;
      if (mergedFilters.site) p.site = mergedFilters.site;
      if (mergedFilters.group) p.group = mergedFilters.group;
      if (mergedFilters.os_name) p.os_name = mergedFilters.os_name;
      if (mergedFilters.ip_address) p.ip_address = mergedFilters.ip_address;
      if (mergedFilters.online_only !== null) p.online_only = mergedFilters.online_only;
      return endpointsApi.stats(p).then((r) => r.data);
    },
    refetchInterval: 60000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['endpoints', filterParams],
    queryFn: () => endpointsApi.list(filterParams).then((r) => r.data),
    refetchInterval: 60000,
  });

  const handleFilterChange = (f: EndpointFilters) => {
    setFilters(f);
    setPage(1);
  };

  return (
    <Box>
      <PageHeader
        title="Endpoint Fleet"
        subtitle="Monitor and filter managed endpoints synced from SentinelOne"
        gradient="linear-gradient(90deg, #f1f5f9, #3b82f6)"
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 2.5,
        }}
      >
        <StatCard
          label="Total Endpoints"
          value={stats?.total ?? filterOptions?.total ?? 0}
          color="#3b82f6"
          icon={<Computer />}
        />
        <StatCard
          label="Online"
          value={stats?.online ?? 0}
          color="#22c55e"
          icon={<Wifi />}
        />
        <StatCard
          label="Offline"
          value={stats?.offline ?? 0}
          color="#ef4444"
          icon={<WifiOff />}
        />
        <StatCard
          label="Filtered Results"
          value={data?.total ?? 0}
          color="#a855f7"
          icon={<Search />}
        />
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 2.5 }}>
        <EndpointFilterBar
          filters={filters}
          onChange={handleFilterChange}
          options={{
            sites: filterOptions?.sites ?? [],
            groups: filterOptions?.groups ?? [],
            os_names: filterOptions?.os_names ?? [],
          }}
        />
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Quick search hostname..."
          value={quickSearch}
          onChange={(e) => { setQuickSearch(sanitizeInput(e.target.value, 255)); setPage(1); }}
          sx={{ ...fieldSx, flex: 1, maxWidth: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
        <Chip
          label={`${data?.total ?? 0} endpoints`}
          size="small"
          variant="outlined"
          sx={{ fontFamily: 'monospace' }}
        />
        <ToggleButtonGroup
          size="small"
          value={view}
          exclusive
          onChange={(_, v) => v && setView(v)}
          sx={{ ml: 'auto' }}
        >
          <ToggleButton value="grid"><ViewModule fontSize="small" /></ToggleButton>
          <ToggleButton value="table"><ViewList fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={180} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      ) : data?.items?.length === 0 ? (
        <EmptyState icon={<Computer />} message="No endpoints match your filters" />
      ) : view === 'grid' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 2,
          }}
        >
          {data?.items?.map((ep) => <EndpointCard key={ep.id} endpoint={ep} />)}
        </Box>
      ) : (
        <StyledTable>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Status', 'Hostname', 'IP Address', 'OS', 'Group', 'Site', 'Last Seen'].map((h) => (
                  <TableCell key={h}>{h.toUpperCase()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items?.map((ep) => (
                <TableRow key={ep.id} hover>
                  <TableCell>
                    <Chip
                      label={ep.is_online ? 'Online' : 'Offline'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: ep.is_online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: ep.is_online ? '#22c55e' : '#ef4444',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{ep.hostname || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#06b6d4' }}>
                    {ep.ip_address || '-'}
                  </TableCell>
                  <TableCell>{ep.os_name} {ep.os_version}</TableCell>
                  <TableCell>{ep.group_name || '-'}</TableCell>
                  <TableCell>{ep.site_name || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    {ep.last_seen ? format(new Date(ep.last_seen), 'MMM d, HH:mm') : '-'}
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
    </Box>
  );
}
