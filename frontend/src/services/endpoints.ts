import api from './api';
import type {
  Alert,
  DashboardSummary,
  Endpoint,
  HeatmapCell,
  Incident,
  LoginResponse,
  PaginatedResponse,
  SecurityEvent,
  ThreatFeedItem,
  TimelinePoint,
  TopAsset,
  User,
} from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
  register: (data: { name: string; email: string; password: string; role: string }) =>
    api.post<User>('/auth/register', data),
};

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  threats: (limit = 20) => api.get<ThreatFeedItem[]>(`/dashboard/threats?limit=${limit}`),
  heatmap: () => api.get<HeatmapCell[]>('/dashboard/heatmap'),
  timeline: (hours = 24) => api.get<TimelinePoint[]>(`/dashboard/timeline?hours=${hours}`),
  endpoints: () => api.get('/dashboard/endpoints'),
  topAssets: (limit = 10) => api.get<TopAsset[]>(`/dashboard/top-assets?limit=${limit}`),
  analystWorkload: () => api.get('/dashboard/analyst-workload'),
  incidentDistribution: () => api.get<Record<string, number>>('/dashboard/incident-distribution'),
};

export const alertsApi = {
  list: (params: Record<string, string | number | boolean>) =>
    api.get<PaginatedResponse<Alert>>('/alerts', { params }),
  stats: () => api.get<{ total: number; critical: number; open: number; new: number }>('/alerts/stats'),
  severities: () => api.get<{ name: string; count: number }[]>('/alerts/severities'),
  get: (id: string) => api.get<Alert>(`/alerts/${id}`),
  update: (id: string, data: Partial<Alert>) => api.patch<Alert>(`/alerts/${id}`, data),
  bulk: (data: { alert_ids: string[]; action: string; value?: string; analyst_id?: string }) =>
    api.post('/alerts/bulk', data),
  createIncident: (id: string) => api.post(`/alerts/${id}/incident`),
};

export const incidentsApi = {
  list: (params: Record<string, string | number>) =>
    api.get<PaginatedResponse<Incident>>('/incidents', { params }),
  get: (id: string) => api.get<Incident>(`/incidents/${id}`),
  create: (data: Partial<Incident>) => api.post<Incident>('/incidents', data),
  update: (id: string, data: Partial<Incident>) => api.patch<Incident>(`/incidents/${id}`, data),
  addEvidence: (id: string, evidence: { filename: string; content_type: string; data: string }) =>
    api.post(`/incidents/${id}/evidence`, evidence),
};

export interface EndpointFilterOptions {
  sites: { name: string; count: number }[];
  groups: { name: string; count: number }[];
  os_names: { name: string; count: number }[];
  total: number;
  online: number;
  offline: number;
}

export interface EndpointStats {
  total: number;
  online: number;
  offline: number;
}

export const endpointsApi = {
  list: (params: Record<string, string | number | boolean>) =>
    api.get<PaginatedResponse<Endpoint>>('/endpoints', { params }),
  get: (id: string) => api.get<Endpoint>(`/endpoints/${id}`),
  filters: () => api.get<EndpointFilterOptions>('/endpoints/filters'),
  stats: (params: Record<string, string | boolean>) =>
    api.get<EndpointStats>('/endpoints/stats', { params }),
};

export const eventsApi = {
  list: (params: Record<string, string | number>) =>
    api.get<PaginatedResponse<SecurityEvent>>('/events', { params }),
  get: (id: string) => api.get<SecurityEvent>(`/events/${id}`),
  stats: () => api.get<{ total: number; remote_desktop: number; by_category: Record<string, number> }>('/events/stats'),
};

export const syncApi = {
  trigger: (full = false) =>
    api.post<{
      status: string;
      task_id?: string;
      mode?: string;
      message?: string;
      counts?: Record<string, number>;
    }>(`/sync?full=${full}`),
  status: () => api.get<{
    configured: boolean;
    api_healthy: boolean;
    base_url: string | null;
    running: boolean;
    started_at?: string;
    completed_at?: string;
    counts?: Record<string, number>;
    error?: string;
  }>('/sync/status'),
};

export const usersApi = {
  list: () => api.get<User[]>('/users'),
};

export const threatsApi = {
  list: (params: Record<string, string> = {}) =>
    api.get<{
      threats: Array<{
        id: string; title: string; severity: string;
        hostname?: string; status: string; created_at: string;
      }>;
      severity_distribution: Record<string, number>;
      total: number;
      filtered_total: number;
    }>('/threats', { params }),
};

export const enrichmentApi = {
  enrich: (ioc_type: string, ioc_value: string) =>
    api.post('/enrichment', { ioc_type, ioc_value }),
};
