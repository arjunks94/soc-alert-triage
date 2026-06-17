import { Box, Typography } from '@mui/material';
import type { HeatmapCell } from '../../types';
import { WallboardPanel } from './WallboardPanel';

interface MitreTacticsProps {
  heatmap: HeatmapCell[];
}

export function WallboardMitreTactics({ heatmap }: MitreTacticsProps) {
  const tacticCounts: Record<string, number> = {};
  heatmap.forEach((cell) => {
    tacticCounts[cell.tactic] = (tacticCounts[cell.tactic] || 0) + cell.count;
  });

  const sorted = Object.entries(tacticCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  const max = sorted[0]?.[1] || 1;

  return (
    <WallboardPanel title="MITRE ATT&CK Tactics" accent="#3b82f6">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {sorted.length === 0 ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
            No tactic data
          </Typography>
        ) : (
          sorted.map(([tactic, count]) => {
            const pct = Math.round((count / max) * 100);
            return (
              <Box key={tactic}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      color: 'rgba(255,255,255,0.7)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '75%',
                    }}
                  >
                    {tactic}
                  </Typography>
                  <Typography
                    sx={{ fontSize: '0.65rem', color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}
                  >
                    {count}
                  </Typography>
                </Box>
                <Box sx={{ height: 5, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                  <Box
                    sx={{
                      width: `${pct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
                      borderRadius: 1,
                      boxShadow: '0 0 8px rgba(59,130,246,0.4)',
                    }}
                  />
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </WallboardPanel>
  );
}
