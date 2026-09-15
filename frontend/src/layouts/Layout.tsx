import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  AppBar, Toolbar, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Box, IconButton, Typography, Avatar, Menu, MenuItem,
  Divider, useMediaQuery, Tooltip, Badge, Chip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddCardIcon from '@mui/icons-material/AddCard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PeopleIcon from '@mui/icons-material/People';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import InventoryIcon from '@mui/icons-material/Inventory2';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { logout } from '../redux/authSlice';
import { showToast } from '../redux/uiSlice';
import LanguageSwitcher from '../components/LanguageSwitcher';
import useT from '../i18n/useT';

const drawerWidth = 280;

const NAV = [
  { labelKey: 'nav.dashboard', path: '/', icon: DashboardIcon, sectionKey: 'section.overview' },
  { labelKey: 'nav.jobCards', path: '/jobcards', icon: AssignmentIcon, sectionKey: 'section.operations' },
  { labelKey: 'nav.newJobCard', path: '/jobcards/new', icon: AddCardIcon, sectionKey: 'section.operations' },
  { labelKey: 'nav.estimates', path: '/estimates', icon: ReceiptIcon, sectionKey: 'section.operations' },
  { labelKey: 'nav.sellProducts', path: '/sell', icon: ShoppingCartIcon, sectionKey: 'section.operations' },
  { labelKey: 'nav.customers', path: '/customers', icon: PeopleIcon, sectionKey: 'section.directory' },
  { labelKey: 'nav.vehicles', path: '/vehicles', icon: DirectionsCarIcon, sectionKey: 'section.directory' },
  { labelKey: 'nav.advisors', path: '/advisors', icon: SupportAgentIcon, sectionKey: 'section.directory' },
  { labelKey: 'nav.reports', path: '/reports', icon: AssessmentIcon, sectionKey: 'section.insights' },
  { labelKey: 'nav.inventory', path: '/inventory', icon: InventoryIcon, sectionKey: 'section.inventory' },
  { labelKey: 'nav.settings', path: '/settings', icon: SettingsIcon, sectionKey: 'section.system' },
];

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useT();
  const user = useSelector((state) => state.auth.user);
  const isMobile = useMediaQuery('(max-width:900px)');
  const [open, setOpen] = useState(!isMobile);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifEl, setNotifEl] = useState(null);

  const handleLogout = async () => {
    setAnchorEl(null);
    await dispatch(logout());
    dispatch(showToast({ severity: 'info', message: t('common.loggedOut') }));
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', px: 3, py: 3, height: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 48, height: 48, borderRadius: 4,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 900, fontSize: 18,
              boxShadow: '0 4px 16px rgba(11,36,71,0.3)',
              '&:hover': { transform: 'scale(1.05)' },
            }}
          >
            AR
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {t('app.brand')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 0.5 }}>
              {t('app.tagline')}
            </Typography>
          </Box>
        </Box>
        {!isMobile && (
          <Tooltip title={t('action.collapseSidebar')}>
            <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: 'text.secondary' }}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider sx={{ my: 1 }} />
      <List sx={{ px: 1.5, py: 1, flexGrow: 1, overflowY: 'auto' }}>
        {NAV.map((item, idx) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const showSection = idx === 0 || NAV[idx - 1].sectionKey !== item.sectionKey;
          return (
            <Box key={item.path} sx={{ marginBottom: 0.25 }}>
              {showSection && (
                <Typography variant="caption" sx={{ px: 1.5, pt: 1.5, pb: 0.5, color: 'text.muted', fontWeight: 600, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block' }}>
                  {t(item.sectionKey)}
                </Typography>
              )}
              <ListItem disablePadding sx={{ borderRadius: 2 }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={active}
                  sx={{
                    borderRadius: 2, py: 0.7, px: 1.5,
                    transition: 'all 0.15s ease',
                    ...(active && {
                      bgcolor: 'rgba(15,23,42,0.08)',
                      '& .MuiListItemIcon-root': { color: 'primary.main' },
                      '& .MuiListItemText-primary': { fontWeight: 600, color: 'primary.main' },
                    }),
                    '&:hover': { bgcolor: 'rgba(15,23,42,0.04)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 38, color: active ? 'primary.main' : 'text.secondary' }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontSize: '0.82rem' }} />
                </ListItemButton>
              </ListItem>
            </Box>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="caption" color="text.muted" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>
          {t('app.version')}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: open ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { sm: open ? `${drawerWidth}px` : 0 },
          transition: 'all 0.2s',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 }, minHeight: '64px !important' }}>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(!open)} sx={{ mr: 1.5 }}>
            <MenuIcon fontSize="small" />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600, fontSize: '0.9375rem', display: { xs: 'none', sm: 'block' }, color: 'text.primary' }}>
            {t('app.title')}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={t('action.notifications')}>
              <IconButton color="inherit" onClick={(e) => setNotifEl(e.currentTarget)}>
                <Badge badgeContent={0} color="error" variant="dot">
                  <NotificationsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Menu anchorEl={notifEl} open={!!notifEl} onClose={() => setNotifEl(null)}>
              <MenuItem disabled>{t('action.noNotifications')}</MenuItem>
            </Menu>

            <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 1 }} />

            <LanguageSwitcher />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 0.5 }}>
              <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" fontWeight={600} lineHeight={1.2} color="text.primary">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </Typography>
                <Chip label={user?.role || 'User'} size="small" sx={{ height: 18, fontSize: '0.625rem', fontWeight: 600, bgcolor: 'grey.100', color: 'text.secondary' }} />
              </Box>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
                <Avatar sx={{ width: 36, height: 36, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', fontSize: '0.8rem', fontWeight: 700 }}>
                  {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Box>

            <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { minWidth: 200, mt: 1 } }}>
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" fontWeight={700}>{user?.name || 'User'}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                <Chip label={user?.role} size="small" color="primary" sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }} />
              </Box>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <LogoutIcon fontSize="small" sx={{ mr: 1.5, color: 'error.main' }} /> {t('action.signOut')}
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          width: { sm: open ? drawerWidth : 0 },
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: open ? `calc(100% - ${drawerWidth}px)` : '100%' },
          mt: 8,
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Box
          className="fade-in-up"
          sx={{ maxWidth: 1040, margin: '0 auto', width: '100%' }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}