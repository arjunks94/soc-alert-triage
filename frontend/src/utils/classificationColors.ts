/** SentinelOne severity levels and threat classifications with consistent colors. */
export const classificationColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#6b7280',
  MALWARE: '#ef4444',
  RANSOMWARE: '#b91c1c',
  TROJAN: '#f97316',
  PUP: '#eab308',
  PUA: '#eab308',
  EXPLOIT: '#a855f7',
  CRYPTOMINER: '#06b6d4',
  CRYPTOMINING: '#06b6d4',
  DOWNLOADER: '#3b82f6',
  BACKDOOR: '#dc2626',
  ROOTKIT: '#7c3aed',
  WORM: '#ea580c',
  SPYWARE: '#d946ef',
  ADWARE: '#facc15',
  HACKTOOL: '#8b5cf6',
  VIRUS: '#ef4444',
  GENERIC: '#6b7280',
  UNKNOWN: '#6b7280',
  SUSPICIOUS: '#f59e0b',
  PHISHING: '#0ea5e9',
  LATERAL_MOVEMENT: '#ec4899',
  CREDENTIAL_THEFT: '#e11d48',
  UNCHECKED: '#9ca3af',
};

export function normalizeClassificationKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

export function getClassificationColor(name: string): string {
  const key = normalizeClassificationKey(name);
  if (classificationColors[key]) return classificationColors[key];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function formatClassificationLabel(name: string): string {
  return normalizeClassificationKey(name).replace(/_/g, ' ');
}

/** @deprecated use classificationColors / getClassificationColor */
export const severityColors = classificationColors;
