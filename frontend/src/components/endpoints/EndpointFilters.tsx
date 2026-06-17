import {
  Box, TextField, Autocomplete, Chip, IconButton, Tooltip, InputAdornment,
} from '@mui/material';
import {
  Dns, LocationOn, Group, Computer, Router, FilterAlt, Clear,
} from '@mui/icons-material';

export interface EndpointFilters {
  hostname: string;
  site: string;
  group: string;
  os_name: string;
  ip_address: string;
  online_only: boolean | null;
}

interface FilterBarProps {
  filters: EndpointFilters;
  onChange: (filters: EndpointFilters) => void;
  options: {
    sites: { name: string; count: number }[];
    groups: { name: string; count: number }[];
    os_names: { name: string; count: number }[];
  };
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(0,0,0,0.25)',
    borderRadius: 2,
    fontSize: '0.85rem',
    '& fieldset': { borderColor: 'rgba(59,130,246,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(59,130,246,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8rem' },
};

export function EndpointFilterBar({ filters, onChange, options }: FilterBarProps) {
  const set = (key: keyof EndpointFilters, value: string | boolean | null) =>
    onChange({ ...filters, [key]: value });

  const activeCount = [
    filters.hostname,
    filters.site,
    filters.group,
    filters.os_name,
    filters.ip_address,
    filters.online_only !== null ? 'x' : '',
  ].filter(Boolean).length;

  const clearAll = () =>
    onChange({
      hostname: '',
      site: '',
      group: '',
      os_name: '',
      ip_address: '',
      online_only: null,
    });

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.95) 100%)',
        border: '1px solid rgba(59,130,246,0.2)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FilterAlt sx={{ color: '#3b82f6', fontSize: 20 }} />
        <Box sx={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.05em' }}>
          ENDPOINT FILTERS
        </Box>
        {activeCount > 0 && (
          <>
            <Chip label={`${activeCount} active`} size="small" color="primary" variant="outlined" />
            <Tooltip title="Clear all filters">
              <IconButton size="small" onClick={clearAll} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                <Clear fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(5, 1fr)' },
          gap: 1.5,
        }}
      >
        <TextField
          size="small"
          label="Endpoint Name"
          placeholder="Search hostname..."
          value={filters.hostname}
          onChange={(e) => set('hostname', e.target.value)}
          sx={fieldSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Dns sx={{ fontSize: 18, color: '#3b82f6' }} />
              </InputAdornment>
            ),
          }}
        />

        <Autocomplete
          size="small"
          freeSolo
          options={options.sites.map((s) => s.name)}
          value={filters.site}
          onInputChange={(_, v) => set('site', v)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Site"
              placeholder="Select or type site..."
              sx={fieldSx}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <LocationOn sx={{ fontSize: 18, color: '#22c55e' }} />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            const count = options.sites.find((s) => s.name === option)?.count;
            return (
              <li {...props} key={option}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>{option}</span>
                  <Chip label={count} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                </Box>
              </li>
            );
          }}
        />

        <Autocomplete
          size="small"
          freeSolo
          options={options.groups.map((g) => g.name)}
          value={filters.group}
          onInputChange={(_, v) => set('group', v)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Group"
              placeholder="Select or type group..."
              sx={fieldSx}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <Group sx={{ fontSize: 18, color: '#f97316' }} />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <Autocomplete
          size="small"
          freeSolo
          options={options.os_names.map((o) => o.name)}
          value={filters.os_name}
          onInputChange={(_, v) => set('os_name', v)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Operating System"
              placeholder="Windows, Linux, macOS..."
              sx={fieldSx}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <Computer sx={{ fontSize: 18, color: '#a855f7' }} />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <TextField
          size="small"
          label="IP Address"
          placeholder="10.0.0.1"
          value={filters.ip_address}
          onChange={(e) => set('ip_address', e.target.value)}
          sx={fieldSx}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Router sx={{ fontSize: 18, color: '#06b6d4' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        {[
          { label: 'All', value: null, color: '#6b7280' },
          { label: 'Online', value: true, color: '#22c55e' },
          { label: 'Offline', value: false, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <Chip
            key={label}
            label={label}
            size="small"
            onClick={() => set('online_only', value)}
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              bgcolor: filters.online_only === value ? `${color}22` : 'transparent',
              color: filters.online_only === value ? color : 'rgba(255,255,255,0.5)',
              border: `1px solid ${filters.online_only === value ? color : 'rgba(255,255,255,0.15)'}`,
              '&:hover': { bgcolor: `${color}15` },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export const emptyFilters: EndpointFilters = {
  hostname: '',
  site: '',
  group: '',
  os_name: '',
  ip_address: '',
  online_only: null,
};

export function buildFilterParams(filters: EndpointFilters, page: number) {
  const params: Record<string, string | number | boolean> = { page, page_size: 24 };
  if (filters.hostname) params.hostname = filters.hostname;
  if (filters.site) params.site = filters.site;
  if (filters.group) params.group = filters.group;
  if (filters.os_name) params.os_name = filters.os_name;
  if (filters.ip_address) params.ip_address = filters.ip_address;
  if (filters.online_only !== null) params.online_only = filters.online_only;
  return params;
}
