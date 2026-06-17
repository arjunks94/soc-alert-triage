import { TableContainer, Paper } from '@mui/material';
import type { ReactNode } from 'react';

export function StyledTable({ children }: { children: ReactNode }) {
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 3,
        border: '1px solid rgba(59,130,246,0.15)',
        bgcolor: 'rgba(15,23,42,0.6)',
        '& .MuiTableHead-root .MuiTableCell-root': {
          fontWeight: 700,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          color: '#3b82f6',
          borderBottom: '1px solid rgba(59,130,246,0.2)',
        },
        '& .MuiTableRow-root:hover': {
          bgcolor: 'rgba(59,130,246,0.05)',
        },
      }}
    >
      {children}
    </TableContainer>
  );
}
