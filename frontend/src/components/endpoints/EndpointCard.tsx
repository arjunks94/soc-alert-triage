import type { ReactNode } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  Computer, Circle, Dns, LocationOn, Group, Memory,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import type { Endpoint } from '../../types';

function OsIcon({ os }: { os?: string }) {
  const name = (os || '').toLowerCase();
  let color = '#6b7280';
  let label = os || 'Unknown';

  if (name.includes('windows')) color = '#3b82f6';
  else if (name.includes('linux') || name.includes('ubuntu') || name.includes('centos')) color = '#f97316';
  else if (name.includes('mac') || name.includes('darwin')) color = '#a855f7';

  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: `${color}18`,
        border: `1px solid ${color}33`,
      }}
    >
      <Computer sx={{ fontSize: 20, color }} titleAccess={label} />
    </Box>
  );
}

interface EndpointCardProps {
  endpoint: Endpoint;
}

export function EndpointCard({ endpoint }: EndpointCardProps) {
  const isOnline = endpoint.is_online;
  const statusColor = isOnline ? '#22c55e' : '#ef4444';

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 100%)',
        border: `1px solid ${isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}`,
        transition: 'all 0.2s ease',
        cursor: 'default',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${statusColor}33`,
          borderColor: `${statusColor}44`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)`,
          opacity: isOnline ? 0.8 : 0.4,
        },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <OsIcon os={endpoint.os_name} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Circle
              sx={{
                fontSize: 10,
                color: statusColor,
                filter: isOnline ? `drop-shadow(0 0 4px ${statusColor})` : 'none',
                animation: isOnline ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.95rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {endpoint.hostname || 'Unknown'}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: '#06b6d4',
              mt: 0.25,
            }}
          >
            {endpoint.ip_address || 'No IP'}
          </Typography>
        </Box>
        <Chip
          label={isOnline ? 'Online' : 'Offline'}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: `${statusColor}18`,
            color: statusColor,
            border: `1px solid ${statusColor}44`,
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          mb: 1.5,
        }}
      >
        <MetaItem icon={<Memory sx={{ fontSize: 14 }} />} label="OS" value={`${endpoint.os_name || '-'} ${endpoint.os_version || ''}`.trim()} />
        <MetaItem icon={<Group sx={{ fontSize: 14 }} />} label="Group" value={endpoint.group_name || '-'} />
        <MetaItem icon={<LocationOn sx={{ fontSize: 14 }} />} label="Site" value={endpoint.site_name || '-'} />
        <MetaItem icon={<Dns sx={{ fontSize: 14 }} />} label="Agent" value={endpoint.agent_id?.slice(0, 12) || '-'} mono />
      </Box>

      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>
        Last seen{' '}
        {endpoint.last_seen
          ? `${formatDistanceToNow(new Date(endpoint.last_seen), { addSuffix: true })} · ${format(new Date(endpoint.last_seen), 'MMM d HH:mm')}`
          : 'Never'}
      </Typography>
    </Box>
  );
}

function MetaItem({
  icon, label, value, mono,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
        <Box sx={{ color: 'rgba(255,255,255,0.35)' }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.75)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: mono ? 'monospace' : 'inherit',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
