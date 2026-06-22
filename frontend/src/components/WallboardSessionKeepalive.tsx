import { useEffect } from 'react';
import axios from 'axios';
import { useWallboardAuthStore } from '../stores/wallboardAuthStore';

/** Proactively refresh wallboard tokens so kiosk displays stay signed in. */
export function WallboardSessionKeepalive() {
  useEffect(() => {
    const refresh = async () => {
      const { refreshToken, setTokens } = useWallboardAuthStore.getState();
      if (!refreshToken) return;
      try {
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
        setTokens(data.access_token, data.refresh_token);
      } catch {
        // Retry on next interval; do not force logout on transient failures
      }
    };

    refresh();
    const id = setInterval(refresh, 12 * 60 * 60 * 1000); // every 12 hours
    return () => clearInterval(id);
  }, []);

  return null;
}
