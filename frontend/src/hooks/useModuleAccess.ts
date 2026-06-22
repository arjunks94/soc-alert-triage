import { usePermissions } from './usePermissions';
import type { ModuleId, PermissionLevel } from '../constants/rbac';

export function useModuleAccess(module: ModuleId, minimum: PermissionLevel = 'view') {
  const { hasAccess, isLoading, role, permissions } = usePermissions();
  return {
    allowed: hasAccess(module, minimum),
    isLoading,
    role,
    permissions,
  };
}

export function useHasModuleAccess() {
  const { hasAccess, isLoading } = usePermissions();
  return { hasAccess, isLoading };
}
