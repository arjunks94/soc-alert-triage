/** True when served from the dedicated wallboard port (default 8080). */
export function isWallboardHost(): boolean {
  if (typeof window === 'undefined') return false;
  const port = window.location.port;
  return port === '8080' || import.meta.env.VITE_WALLBOARD_MODE === 'true';
}

export function wallboardLoginPath(): string {
  return isWallboardHost() ? '/login' : '/login';
}
