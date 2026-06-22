import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Box, Avatar, Menu, MenuItem,
} from '@mui/material';
import {
  Dashboard, Warning, Report, Computer, Security, People, Settings,
  Tv, Menu as MenuIcon, Logout, Event,
} from '@mui/icons-material';
import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/authStore';
import { APP_MODULES } from '../constants/rbac';
import { usePermissions } from '../hooks/usePermissions';
import type { ModuleId } from '../constants/rbac';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', path: '/', icon: <Dashboard />, module: 'dashboard' as ModuleId },
  { label: 'Alerts', path: '/alerts', icon: <Warning />, module: 'alerts' as ModuleId },
  { label: 'Incidents', path: '/incidents', icon: <Report />, module: 'incidents' as ModuleId },
  { label: 'Endpoints', path: '/endpoints', icon: <Computer />, module: 'endpoints' as ModuleId },
  { label: 'Events', path: '/events', icon: <Event />, module: 'events' as ModuleId },
  { label: 'Threats', path: '/threats', icon: <Security />, module: 'threats' as ModuleId },
  { label: 'Analysts', path: '/analysts', icon: <People />, module: 'analysts' as ModuleId },
  { label: 'Wallboard', path: '/wallboard', icon: <Tv />, module: 'wallboard' as ModuleId },
  { label: 'Settings', path: '/settings', icon: <Settings />, module: 'settings' as ModuleId },
];

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { hasAccess, isLoading } = usePermissions();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const visibleNav = navItems.filter((item) => hasAccess(item.module, 'view'));
  const currentModule = APP_MODULES.find((m) => m.path === location.pathname);

  if (!isLoading && currentModule && !hasAccess(currentModule.id, 'view')) {
    const fallback = visibleNav[0]?.path ?? '/';
    if (fallback !== location.pathname) {
      return <Navigate to={fallback} replace />;
    }
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" onClick={toggleSidebar} edge="start" sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Security sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            SOC Dashboard
          </Typography>
          <Typography variant="caption" sx={{ mr: 2, color: 'text.secondary' }}>
            SentinelOne Integration
          </Typography>
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark', fontSize: 14 }}>
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2">{user?.name} ({user?.role})</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', mt: '64px' },
        }}
      >
        <List>
          {visibleNav.map((item) => (
            <ListItemButton
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  borderRight: '3px solid',
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(0,188,212,0.08)',
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: '64px',
          ml: sidebarOpen ? 0 : `-${DRAWER_WIDTH}px`,
          transition: 'margin 0.2s',
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
