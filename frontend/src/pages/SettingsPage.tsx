import { Box, Typography, TextField, Button, Alert, Divider } from '@mui/material';
import { Security } from '@mui/icons-material';
import { useState } from 'react';
import { enrichmentApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
import { GlassPanel, fieldSx } from '../components/ui/GlassPanel';
import { sanitizeInput } from '../utils/sanitize';

export function SettingsPage() {
  const [iocType, setIocType] = useState('ip');
  const [iocValue, setIocValue] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEnrich = async () => {
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { data } = await enrichmentApi.enrich(iocType, sanitizeInput(iocValue, 500));
      setResult(data.providers as Record<string, unknown>);
    } catch {
      setError('Enrichment failed. Check API keys in environment configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="IOC enrichment and system configuration"
        gradient="linear-gradient(90deg, #f1f5f9, #22c55e)"
      />

      <GlassPanel title="IOC Enrichment" accent="#22c55e" sx={{ mb: 2.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enrich IPs, file hashes, and domains using VirusTotal, AbuseIPDB, and GreyNoise.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField select label="IOC Type" value={iocType}
            onChange={(e) => setIocType(e.target.value)} SelectProps={{ native: true }}
            size="small" sx={{ ...fieldSx, minWidth: 140 }}>
            <option value="ip">IP Address</option>
            <option value="hash">File Hash</option>
            <option value="domain">Domain</option>
          </TextField>
          <TextField label="IOC Value" value={iocValue}
            onChange={(e) => setIocValue(sanitizeInput(e.target.value, 500))}
            size="small" sx={{ ...fieldSx, flexGrow: 1, minWidth: 200 }} />
          <Button variant="contained" onClick={handleEnrich} disabled={!iocValue || loading}>
            Enrich
          </Button>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        {result && (
          <Box component="pre" sx={{
            bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 2, mt: 2,
            overflow: 'auto', fontSize: '0.8rem', fontFamily: 'monospace',
            border: '1px solid rgba(59,130,246,0.15)',
          }}>
            {JSON.stringify(result, null, 2)}
          </Box>
        )}
      </GlassPanel>

      <GlassPanel title="System Information" accent="#3b82f6">
        <Divider sx={{ mb: 2, borderColor: 'rgba(59,130,246,0.15)' }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2"><strong>Version:</strong> 1.0.0</Typography>
          <Typography variant="body2"><strong>Integration:</strong> SentinelOne Cloud API v2.1</Typography>
          <Typography variant="body2"><strong>Sync Intervals:</strong> Alerts 60s · Agents 5m · Incidents 2m</Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <Security sx={{ fontSize: 16, color: '#22c55e' }} />
            All API endpoints require JWT authentication
          </Typography>
        </Box>
      </GlassPanel>
    </Box>
  );
}
