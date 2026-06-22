import { useQuery } from '@tanstack/react-query';
import { rbacApi } from '../services/endpoints';
import { useAuthStore } from '../stores/authStore';
import { canAccess, resolvePermissions, type ModuleId, type PermissionLevel } from '../constants/rbac';

export function usePermissions() {
  const { user, accessToken } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rbac', 'me', user?.role],
    queryFn: () => rbacApi.me().then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const role = data?.role || user?.role;
  const permissions = resolvePermissions(role, isError ? undefined : data?.permissions);

  const hasAccess = (module: ModuleId, minimum: PermissionLevel = 'view') =>
    canAccess(permissions, module, minimum);

  return { permissions, hasAccess, isLoading, role };
}
