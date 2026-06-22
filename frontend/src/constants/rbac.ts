export const APP_MODULES = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'alerts', label: 'Alerts', path: '/alerts' },
  { id: 'incidents', label: 'Incidents', path: '/incidents' },
  { id: 'endpoints', label: 'Endpoints', path: '/endpoints' },
  { id: 'events', label: 'Events', path: '/events' },
  { id: 'threats', label: 'Threats', path: '/threats' },
  { id: 'analysts', label: 'Analysts', path: '/analysts' },
  { id: 'wallboard', label: 'Wallboard', path: '/wallboard' },
  { id: 'settings', label: 'Settings', path: '/settings' },
  { id: 'sync', label: 'SentinelOne Sync', path: '' },
] as const;

export type ModuleId = (typeof APP_MODULES)[number]['id'];
export type PermissionLevel = 'none' | 'view' | 'edit' | 'manage';

export const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'manage', label: 'Manage' },
];

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  manage: 3,
};

export function resolvePermissions(
  role: string | undefined,
  apiPermissions: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const defaults = role ? DEFAULT_PERMISSIONS[role] : undefined;
  if (!defaults) return apiPermissions;
  if (!apiPermissions || Object.keys(apiPermissions).length === 0) return defaults;
  return { ...defaults, ...apiPermissions };
}

export function canAccess(
  permissions: Record<string, string> | undefined,
  module: ModuleId,
  minimum: PermissionLevel = 'view',
): boolean {
  if (!permissions || Object.keys(permissions).length === 0) return true;
  const level = (permissions[module] || 'none') as PermissionLevel;
  return LEVEL_RANK[level] >= LEVEL_RANK[minimum];
}

export const DEFAULT_PERMISSIONS: Record<string, Record<string, string>> = {
  SOC_ADMIN: Object.fromEntries(APP_MODULES.map((m) => [m.id, 'manage'])),
  SOC_MANAGER: {
    dashboard: 'view', alerts: 'edit', incidents: 'edit', endpoints: 'view',
    events: 'view', threats: 'view', analysts: 'view', settings: 'edit',
    wallboard: 'view', sync: 'edit',
  },
  SOC_ANALYST: {
    dashboard: 'view', alerts: 'edit', incidents: 'edit', endpoints: 'view',
    events: 'view', threats: 'view', analysts: 'view', settings: 'none',
    wallboard: 'view', sync: 'edit',
  },
  VIEWER: {
    dashboard: 'view', alerts: 'view', incidents: 'view', endpoints: 'view',
    events: 'view', threats: 'view', analysts: 'none', settings: 'none',
    wallboard: 'view', sync: 'none',
  },
};
