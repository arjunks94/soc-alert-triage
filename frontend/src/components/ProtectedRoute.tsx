import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  minRole?: string;
}

const ROLE_LEVEL: Record<string, number> = {
  VIEWER: 0,
  SOC_ANALYST: 1,
  SOC_MANAGER: 2,
  SOC_ADMIN: 3,
};

export function ProtectedRoute({ children, minRole = 'VIEWER' }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (user && (ROLE_LEVEL[user.role] ?? -1) < (ROLE_LEVEL[minRole] ?? 0)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
