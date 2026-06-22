import { Chip } from '@mui/material';
import { getClassificationColor, formatClassificationLabel } from '../utils/classificationColors';
import { statusColors } from '../theme';

interface SeverityChipProps {
  severity: string;
  size?: 'small' | 'medium';
}

export function SeverityChip({ severity, size = 'small' }: SeverityChipProps) {
  const color = getClassificationColor(severity);
  return (
    <Chip
      label={formatClassificationLabel(severity)}
      size={size}
      sx={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
      }}
    />
  );
}

interface StatusChipProps {
  status: string;
  size?: 'small' | 'medium';
}

export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const color = statusColors[status] || '#6b7280';
  return (
    <Chip
      label={status.replace('_', ' ')}
      size={size}
      sx={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        fontWeight: 500,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
      }}
    />
  );
}
