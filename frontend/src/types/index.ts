export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  sentinel_alert_id: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  hostname?: string;
  username?: string;
  site_name?: string;
  agent_id?: string;
  mitre_tactics: string[];
  mitre_techniques: string[];
  assigned_analyst_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  incident_number: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  assigned_analyst?: string;
  alert_ids: string[];
  evidence: Record<string, unknown>[];
  timeline: TimelineEntry[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEntry {
  action: string;
  user_id?: string;
  details?: string;
  timestamp: string;
}

export interface Endpoint {
  id: string;
  agent_id: string;
  hostname?: string;
  ip_address?: string;
  os_name?: string;
  os_version?: string;
  last_seen?: string;
  health_status?: string;
  is_online: boolean;
  group_name?: string;
  site_name?: string;
  raw_data?: Record<string, unknown>;
}

export interface SecurityEvent {
  id: string;
  sentinel_event_id: string;
  event_type: string;
  category: string;
  title: string;
  description?: string;
  hostname?: string;
  agent_id?: string;
  user_name?: string;
  site_name?: string;
  severity: string;
  event_at: string;
  raw_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  open_incidents: number;
  online_agents: number;
  offline_agents: number;
  total_alerts: number;
  new_alerts: number;
}

export interface ThreatFeedItem {
  id: string;
  title: string;
  severity: string;
  hostname?: string;
  created_at: string;
}

export interface HeatmapCell {
  tactic: string;
  technique: string;
  count: number;
}

export interface TimelinePoint {
  hour: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface TopAsset {
  hostname: string;
  alert_count: number;
  severity_max: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type AlertStatus =
  | 'NEW'
  | 'OPEN'
  | 'INVESTIGATING'
  | 'ESCALATED'
  | 'CONTAINED'
  | 'FALSE_POSITIVE'
  | 'CLOSED';

export type UserRole = 'SOC_ADMIN' | 'SOC_ANALYST' | 'SOC_MANAGER' | 'VIEWER';
