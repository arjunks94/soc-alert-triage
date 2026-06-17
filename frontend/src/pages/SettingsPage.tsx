import { Box, Typography, Card, CardContent, TextField, Button, Alert, Divider } from '@mui/material';
import { useState } from 'react';
import { enrichmentApi } from '../services/endpoints';

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
      const { data } = await enrichmentApi.enrich(iocType, iocValue);
      setResult(data.providers as Record<string, unknown>);
    } catch {
      setError('Enrichment failed. Check API keys in environment configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Settings</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>IOC Enrichment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enrich IPs, file hashes, and domains using VirusTotal, AbuseIPDB, and GreyNoise.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField select label="IOC Type" value={iocType}
              onChange={(e) => setIocType(e.target.value)} SelectProps={{ native: true }} size="small">
              <option value="ip">IP Address</option>
              <option value="hash">File Hash</option>
              <option value="domain">Domain</option>
            </TextField>
            <TextField label="IOC Value" value={iocValue}
              onChange={(e) => setIocValue(e.target.value)} size="small" sx={{ flexGrow: 1 }} />
            <Button variant="contained" onClick={handleEnrich}
              disabled={!iocValue || loading}>
              Enrich
            </Button>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Box component="pre" sx={{
              bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 1,
              overflow: 'auto', fontSize: '0.8rem', fontFamily: 'monospace',
            }}>
              {JSON.stringify(result, null, 2)}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>System Information</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2"><strong>Version:</strong> 1.0.0</Typography>
          <Typography variant="body2"><strong>Integration:</strong> SentinelOne Cloud API v2.1</Typography>
          <Typography variant="body2"><strong>Sync Intervals:</strong> Alerts 60s · Agents 5m · Incidents 2m</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
