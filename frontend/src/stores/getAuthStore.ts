import { isWallboardHost } from '../utils/wallboard';
import { useAuthStore } from './authStore';
import { useWallboardAuthStore } from './wallboardAuthStore';

export type AuthStore = typeof useAuthStore;

export function getAuthStore(): AuthStore {
  return isWallboardHost() ? useWallboardAuthStore : useAuthStore;
}
