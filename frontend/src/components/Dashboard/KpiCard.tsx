import type { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  color: string;
  gradient: string;
}

export default function KpiCard({ label, value, sub, icon, color, gradient }: KpiCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, lineHeight: 1.3 }}>{label}</Typography>
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box component="span" sx={{ color: 'white', display: 'flex' }}>{icon}</Box>
          </Box>
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color, lineHeight: 1.1, fontSize: '1.75rem' }}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.muted" sx={{ mt: 0.5, display: 'block' }}>{sub}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}
