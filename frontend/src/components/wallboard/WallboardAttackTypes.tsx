import { Box, Typography } from '@mui/material';
import {
  BugReport, Lock, Phishing, Code, MoreHoriz,
} from '@mui/icons-material';
import { WallboardPanel } from './WallboardPanel';

const TYPE_ICONS: Record<string, typeof BugReport> = {
  MALWARE: BugReport,
  RANSOMWARE: Lock,
  PHISHING: Phishing,
  GENERAL: Code,
  BENIGN: MoreHoriz,
  CRYPTOMINER: BugReport,
};

const TYPE_COLORS: Record<string, string> = {
  MALWARE: '#ef4444',
  RANSOMWARE: '#f97316',
  PHISHING: '#eab308',
  GENERAL: '#3b82f6',
  BENIGN: '#22c55e',
  CRYPTOMINER: '#a855f7',
};

interface AttackTypesProps {
  distribution: Record<string, number>;
}

export function WallboardAttackTypes({ distribution }: AttackTypesProps) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(distribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <WallboardPanel title="Attack Types" accent="#f97316">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sorted.length === 0 ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
            No threat data
          </Typography>
        ) : (
          sorted.map(([type, count]) => {
            const pct = Math.round((count / total) * 100);
            const Icon = TYPE_ICONS[type] || MoreHoriz;
            const color = TYPE_COLORS[type] || '#6b7280';
            return (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Icon sx={{ fontSize: 16, color }} />
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', minWidth: 90 }}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </Typography>
                <Box sx={{ flex: 1, height: 6, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1 }}>
                  <Box
                    sx={{
                      width: `${pct}%`,
                      height: '100%',
                      bgcolor: color,
                      borderRadius: 1,
                      boxShadow: `0 0 6px ${color}66`,
                    }}
                  />
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color,
                    minWidth: 32,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                  }}
                >
                  {pct}%
                </Typography>
              </Box>
            );
          })
        )}
      </Box>
    </WallboardPanel>
  );
}
