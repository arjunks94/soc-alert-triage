import axios from 'axios';
import { getAuthStore } from '../stores/getAuthStore';
import { isWallboardHost } from '../utils/wallboard';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAuthStore().getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const store = getAuthStore().getState();
  const { refreshToken, setTokens, logout } = store;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    if (!isWallboardHost()) {
      logout();
    }
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (!isWallboardHost()) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
