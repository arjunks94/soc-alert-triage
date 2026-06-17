import { Box, Typography } from '@mui/material';
import { format } from 'date-fns';
import type { ThreatFeedItem } from '../../types';
import { WallboardPanel } from './WallboardPanel';

interface ThreatFeedProps {
  threats: ThreatFeedItem[];
}

function WorldMapBg() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        opacity: 0.15,
        backgroundImage: `
          radial-gradient(circle at 20% 40%, rgba(239,68,68,0.8) 2px, transparent 2px),
          radial-gradient(circle at 45% 30%, rgba(239,68,68,0.6) 3px, transparent 3px),
          radial-gradient(circle at 70% 50%, rgba(239,68,68,0.7) 2px, transparent 2px),
          radial-gradient(circle at 55% 65%, rgba(239,68,68,0.5) 2px, transparent 2px),
          radial-gradient(circle at 30% 70%, rgba(239,68,68,0.6) 2px, transparent 2px),
          radial-gradient(circle at 80% 35%, rgba(239,68,68,0.4) 2px, transparent 2px)
        `,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        },
      }}
    />
  );
}

export function WallboardThreatFeed({ threats }: ThreatFeedProps) {
  return (
    <WallboardPanel title="Threat Feed" accent="#ef4444" height="100%">
      <Box sx={{ position: 'relative', height: '100%', minHeight: 200 }}>
        <WorldMapBg />
        <Box sx={{ position: 'relative', zIndex: 1, maxHeight: 220, overflowY: 'auto' }}>
          {threats.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', p: 1 }}>
              No active threats
            </Typography>
          ) : (
            threats.map((t) => (
              <Box
                key={t.id}
                sx={{
                  display: 'flex',
                  gap: 1,
                  py: 0.75,
                  px: 0.5,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' },
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    color: '#ef4444',
                    minWidth: 42,
                    fontWeight: 600,
                  }}
                >
                  {format(new Date(t.created_at), 'HH:mm')}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      color: '#f1f5f9',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                    {t.hostname || 'Unknown host'}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </WallboardPanel>
  );
}
