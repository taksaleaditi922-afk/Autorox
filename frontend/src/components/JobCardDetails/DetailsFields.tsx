import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>{children}</Typography>;
}

interface RowProps {
  label: string;
  value: ReactNode;
}

export function Row({ label, value }: RowProps) {
  return (
    <Box sx={{ display: 'flex', mb: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 150, flexShrink: 0 }}>{label}</Typography>
      <Box>{value}</Box>
    </Box>
  );
}
