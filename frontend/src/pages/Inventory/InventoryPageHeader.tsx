import type { ReactNode } from 'react';
import { Avatar, Box, Card, IconButton, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

interface InventoryPageHeaderProps {
  title: string;
  avatarLabel: string;
  onMenuClick?: () => void;
  children?: ReactNode;
}

export default function InventoryPageHeader({
  title,
  avatarLabel,
  onMenuClick,
  children,
}: InventoryPageHeaderProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, p: { xs: 1.5, sm: 2 }, flexWrap: 'wrap' }}>
        <IconButton
          aria-label="Toggle navigation"
          onClick={onMenuClick}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 44, height: 44 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h5" fontWeight={800} sx={{ flexGrow: 1, minWidth: 0, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {title}
        </Typography>

        {children}

        <Avatar sx={{ width: 44, height: 44, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', fontSize: '0.9rem', fontWeight: 700 }}>
          {avatarLabel}
        </Avatar>
      </Box>
    </Card>
  );
}
