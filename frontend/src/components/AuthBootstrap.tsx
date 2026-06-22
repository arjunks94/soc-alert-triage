import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/endpoints';

/** Restore user profile after refresh when only tokens are persisted. */
export function AuthBootstrap() {
  const { accessToken, user, setUser } = useAuthStore();

  useEffect(() => {
    if (accessToken && !user) {
      authApi.me()
        .then((res) => setUser(res.data))
        .catch(() => { /* interceptor handles auth errors */ });
    }
  }, [accessToken, user, setUser]);

  return null;
}
