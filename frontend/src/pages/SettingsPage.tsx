import {
  Box, Typography, TextField, Button, Alert, Tabs, Tab, Switch,
  FormControlLabel, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, Chip, Snackbar,
} from '@mui/material';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { enrichmentApi, settingsApi, usersApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
import { GlassPanel, fieldSx } from '../components/ui/GlassPanel';
import { RolePermissionsMatrix } from '../components/RolePermissionsMatrix';
import { SyncRefreshButton } from '../components/SyncRefreshButton';
import { StyledTable } from '../components/ui/StyledTable';
import { useAuthStore } from '../stores/authStore';
import { sanitizeInput } from '../utils/sanitize';
import type { User } from '../types';

const ROLES = ['SOC_ADMIN', 'SOC_MANAGER', 'SOC_ANALYST', 'VIEWER'];

interface TabPanelProps { children?: React.ReactNode; value: number; index: number }
function TabPanel({ children, value, index }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function IntegrationForm({
  title, accent, fields, config, enabled, onChange, onSave, onTest, saving, testing, testResult,
}: {
  title: string; accent: string;
  fields: { key: string; label: string; type?: string; helper?: string }[];
  config: Record<string, unknown>; enabled: boolean;
  onChange: (c: Record<string, unknown>, e: boolean) => void;
  onSave: () => void; onTest: () => void;
  saving: boolean; testing: boolean;
  testResult: { ok?: boolean; message?: string; error?: string } | null;
}) {
  return (
    <GlassPanel title={title} accent={accent}>
      <FormControlLabel
        control={<Switch checked={enabled} onChange={(e) => onChange(config, e.target.checked)} />}
        label="Enabled"
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {fields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            type={f.type || 'text'}
            value={String(config[f.key] ?? '')}
            helperText={f.helper}
            onChange={(e) => onChange({ ...config, [f.key]: e.target.value }, enabled)}
            size="small"
            sx={fieldSx}
            fullWidth
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        <Button variant="contained" onClick={onSave} disabled={saving}>Save</Button>
        <Button variant="outlined" onClick={onTest} disabled={testing}>Test Connection</Button>
      </Box>
      {testResult && (
        <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
          {testResult.message || testResult.error}
        </Alert>
      )}
    </GlassPanel>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState(0);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SOC_ADMIN';
  const isManager = ['SOC_ADMIN', 'SOC_MANAGER'].includes(user?.role || '');
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list().then((r) => r.data),
    enabled: isManager,
  });

  const getSetting = (key: string) => settings?.find((s) => s.key === key);

  const [drafts, setDrafts] = useState<Record<string, { config: Record<string, unknown>; enabled: boolean }>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok?: boolean; message?: string; error?: string }>>({});
  const [iocType, setIocType] = useState('ip');
  const [iocValue, setIocValue] = useState('');
  const [iocResult, setIocResult] = useState<Record<string, unknown> | null>(null);

  const draft = (key: string) => {
    if (drafts[key]) return drafts[key];
    const s = getSetting(key);
    return { config: { ...(s?.config || {}) }, enabled: s?.enabled ?? false };
  };

  const setDraft = (key: string, config: Record<string, unknown>, enabled: boolean) => {
    setDrafts((p) => ({ ...p, [key]: { config, enabled } }));
  };

  const saveMutation = useMutation({
    mutationFn: ({ key, config, enabled }: { key: string; config: Record<string, unknown>; enabled: boolean }) =>
      settingsApi.save(key, { config, enabled }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setDrafts((p) => { const n = { ...p }; delete n[vars.key]; return n; });
      setSnackbar({ message: `${vars.key} settings saved`, severity: 'success' });
    },
    onError: (err: Error) => {
      setSnackbar({ message: err.message || 'Failed to save settings', severity: 'error' });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ key, config }: { key: string; config: Record<string, unknown> }) =>
      settingsApi.test(key, config),
    onSuccess: (res, vars) => setTestResults((p) => ({ ...p, [vars.key]: res.data })),
    onError: (err: Error, vars) => {
      setTestResults((p) => ({ ...p, [vars.key]: { ok: false, error: err.message || 'Test failed' } }));
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users', 'admin'],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: isAdmin,
  });

  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'SOC_ANALYST' });
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const createUserMutation = useMutation({
    mutationFn: () => usersApi.create({
      name: sanitizeInput(userForm.name, 100),
      email: sanitizeInput(userForm.email, 255),
      password: userForm.password,
      role: userForm.role,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setUserDialog(false); },
  });

  const updateUserMutation = useMutation({
    mutationFn: () => usersApi.update(editUser!.id, {
      name: userForm.name, email: userForm.email, role: userForm.role,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); },
  });

  if (!isManager) {
    return (
      <Box>
        <PageHeader title="Settings" subtitle="Configuration requires SOC Manager or Admin role" />
        <Alert severity="warning">You do not have permission to manage integrations.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Integrations, notifications, SIEM, and user access control"
        gradient="linear-gradient(90deg, #f1f5f9, #22c55e)"
        action={<SyncRefreshButton full label="Full Sync" />}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="SentinelOne" />
        <Tab label="SIEM" />
        <Tab label="Syslog" />
        <Tab label="Enrichment" />
        <Tab label="Email SMTP" />
        <Tab label="Telegram" />
        {isAdmin && <Tab label="Users & RBAC" />}
      </Tabs>

      <TabPanel value={tab} index={0}>
        <IntegrationForm
          title="SentinelOne API" accent="#7c3aed"
          fields={[
            { key: 'base_url', label: 'Console URL', helper: 'e.g. https://usea1.sentinelone.net' },
            { key: 'api_token', label: 'API Token', type: 'password' },
          ]}
          {...draft('sentinelone')}
          onChange={(c, e) => setDraft('sentinelone', c, e)}
          onSave={() => saveMutation.mutate({ key: 'sentinelone', ...draft('sentinelone') })}
          onTest={() => testMutation.mutate({ key: 'sentinelone', config: draft('sentinelone').config })}
          saving={saveMutation.isPending} testing={testMutation.isPending}
          testResult={testResults.sentinelone || null}
        />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <IntegrationForm title="Splunk HEC" accent="#65a637"
            fields={[
              { key: 'hec_url', label: 'HEC URL' },
              { key: 'hec_token', label: 'HEC Token', type: 'password' },
              { key: 'index', label: 'Index' },
              { key: 'sourcetype', label: 'Sourcetype', helper: 'default: soc:dashboard' },
            ]}
            {...draft('splunk')} onChange={(c, e) => setDraft('splunk', c, e)}
            onSave={() => saveMutation.mutate({ key: 'splunk', ...draft('splunk') })}
            onTest={() => testMutation.mutate({ key: 'splunk', config: draft('splunk').config })}
            saving={saveMutation.isPending} testing={testMutation.isPending}
            testResult={testResults.splunk || null}
          />
          <IntegrationForm title="Elasticsearch" accent="#f59e0b"
            fields={[
              { key: 'url', label: 'Cluster URL' },
              { key: 'index', label: 'Index', helper: 'default: soc-events' },
              { key: 'api_key', label: 'API Key', type: 'password' },
              { key: 'username', label: 'Username (optional)' },
              { key: 'password', label: 'Password', type: 'password' },
            ]}
            {...draft('elastic')} onChange={(c, e) => setDraft('elastic', c, e)}
            onSave={() => saveMutation.mutate({ key: 'elastic', ...draft('elastic') })}
            onTest={() => testMutation.mutate({ key: 'elastic', config: draft('elastic').config })}
            saving={saveMutation.isPending} testing={testMutation.isPending}
            testResult={testResults.elastic || null}
          />
          <IntegrationForm title="Wazuh" accent="#00a9e0"
            fields={[
              { key: 'url', label: 'Wazuh Indexer / API URL' },
              { key: 'indexer_url', label: 'Indexer URL (if different)' },
              { key: 'index', label: 'Index', helper: 'default: wazuh-alerts' },
              { key: 'username', label: 'Username' },
              { key: 'password', label: 'Password', type: 'password' },
              { key: 'mode', label: 'Mode', helper: 'indexer or api' },
            ]}
            {...draft('wazuh')} onChange={(c, e) => setDraft('wazuh', c, e)}
            onSave={() => saveMutation.mutate({ key: 'wazuh', ...draft('wazuh') })}
            onTest={() => testMutation.mutate({ key: 'wazuh', config: draft('wazuh').config })}
            saving={saveMutation.isPending} testing={testMutation.isPending}
            testResult={testResults.wazuh || null}
          />
        </Box>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <IntegrationForm title="Syslog Forwarding" accent="#06b6d4"
          fields={[
            { key: 'host', label: 'Syslog Host' },
            { key: 'port', label: 'Port', helper: 'default: 514' },
            { key: 'protocol', label: 'Protocol', helper: 'udp or tcp' },
            { key: 'facility', label: 'Facility', helper: 'default: 16 (local0)' },
          ]}
          {...draft('syslog')} onChange={(c, e) => setDraft('syslog', c, e)}
          onSave={() => saveMutation.mutate({ key: 'syslog', ...draft('syslog') })}
          onTest={() => testMutation.mutate({ key: 'syslog', config: draft('syslog').config })}
          saving={saveMutation.isPending} testing={testMutation.isPending}
          testResult={testResults.syslog || null}
        />
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <IntegrationForm title="Threat Intelligence APIs" accent="#22c55e"
          fields={[
            { key: 'virustotal_api_key', label: 'VirusTotal API Key', type: 'password' },
            { key: 'abuseipdb_api_key', label: 'AbuseIPDB API Key', type: 'password' },
            { key: 'greynoise_api_key', label: 'GreyNoise API Key', type: 'password' },
          ]}
          {...draft('enrichment')} onChange={(c, e) => setDraft('enrichment', c, e)}
          onSave={() => saveMutation.mutate({ key: 'enrichment', ...draft('enrichment') })}
          onTest={() => testMutation.mutate({ key: 'enrichment', config: draft('enrichment').config })}
          saving={saveMutation.isPending} testing={testMutation.isPending}
          testResult={testResults.enrichment || null}
        />
        <GlassPanel title="IOC Enrichment Test" accent="#22c55e" sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select size="small" label="IOC Type" value={iocType}
              onChange={(e) => setIocType(e.target.value)} sx={{ ...fieldSx, minWidth: 120 }}
              SelectProps={{ native: true }}>
              <option value="ip">IP</option><option value="hash">Hash</option><option value="domain">Domain</option>
            </TextField>
            <TextField size="small" label="IOC Value" value={iocValue}
              onChange={(e) => setIocValue(sanitizeInput(e.target.value, 500))} sx={{ ...fieldSx, flex: 1 }} />
            <Button variant="contained" onClick={async () => {
              const { data } = await enrichmentApi.enrich(iocType, iocValue);
              setIocResult(data.providers as Record<string, unknown>);
            }}>Test Enrich</Button>
          </Box>
          {iocResult && (
            <Box component="pre" sx={{ mt: 2, fontSize: '0.75rem', overflow: 'auto', bgcolor: 'rgba(0,0,0,0.3)', p: 2, borderRadius: 2 }}>
              {JSON.stringify(iocResult, null, 2)}
            </Box>
          )}
        </GlassPanel>
      </TabPanel>

      <TabPanel value={tab} index={4}>
        <IntegrationForm title="Email / SMTP Alerts" accent="#3b82f6"
          fields={[
            { key: 'host', label: 'SMTP Host' },
            { key: 'port', label: 'Port', helper: '587 for TLS' },
            { key: 'username', label: 'Username' },
            { key: 'password', label: 'Password', type: 'password' },
            { key: 'from_email', label: 'From Email' },
            { key: 'alert_recipients', label: 'Alert Recipients', helper: 'comma-separated emails' },
            { key: 'test_recipient', label: 'Test Recipient' },
          ]}
          {...draft('smtp')} onChange={(c, e) => setDraft('smtp', c, e)}
          onSave={() => saveMutation.mutate({ key: 'smtp', ...draft('smtp') })}
          onTest={() => testMutation.mutate({ key: 'smtp', config: draft('smtp').config })}
          saving={saveMutation.isPending} testing={testMutation.isPending}
          testResult={testResults.smtp || null}
        />
      </TabPanel>

      <TabPanel value={tab} index={5}>
        <IntegrationForm title="Telegram Notifications" accent="#0088cc"
          fields={[
            { key: 'bot_token', label: 'Bot Token', type: 'password' },
            { key: 'chat_id', label: 'Chat ID', helper: 'Group or channel ID for RDP/alert notifications' },
          ]}
          {...draft('telegram')} onChange={(c, e) => setDraft('telegram', c, e)}
          onSave={() => saveMutation.mutate({ key: 'telegram', ...draft('telegram') })}
          onTest={() => testMutation.mutate({ key: 'telegram', config: draft('telegram').config })}
          saving={saveMutation.isPending} testing={testMutation.isPending}
          testResult={testResults.telegram || null}
        />
        <Alert severity="info" sx={{ mt: 2 }}>
          New RDP events from SentinelOne sync are forwarded to Telegram when enabled, matching your external bot format.
        </Alert>
      </TabPanel>

      {isAdmin && (
        <TabPanel value={tab} index={6}>
          <RolePermissionsMatrix />
          <GlassPanel title="User Accounts" accent="#6366f1" sx={{ mt: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Assign each user a role. Module access is controlled in the matrix above.
            </Typography>
            <Button variant="contained" onClick={() => { setUserForm({ name: '', email: '', password: '', role: 'SOC_ANALYST' }); setUserDialog(true); }}>
              Add User
            </Button>
          </GlassPanel>
          <StyledTable>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <TableCell key={h}>{h.toUpperCase()}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.email}</TableCell>
                    <TableCell><Chip label={u.role} size="small" /></TableCell>
                    <TableCell><Chip label={u.is_active ? 'Active' : 'Disabled'} size="small" color={u.is_active ? 'success' : 'default'} /></TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{format(new Date(u.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => {
                        setEditUser(u);
                        setUserForm({ name: u.name, email: u.email, password: '', role: u.role });
                      }}>Edit</Button>
                      <Button size="small" color={u.is_active ? 'warning' : 'success'}
                        onClick={() => usersApi.update(u.id, { is_active: !u.is_active }).then(() => queryClient.invalidateQueries({ queryKey: ['users'] }))}>
                        {u.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StyledTable>
        </TabPanel>
      )}

      <Dialog open={userDialog || !!editUser} onClose={() => { setUserDialog(false); setEditUser(null); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1117' } }}>
        <DialogTitle>{editUser ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" margin="normal" sx={fieldSx} value={userForm.name}
            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
          <TextField fullWidth label="Email" margin="normal" sx={fieldSx} value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          {!editUser && (
            <TextField fullWidth label="Password" type="password" margin="normal" sx={fieldSx} value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          )}
          <FormControl fullWidth margin="normal" sx={fieldSx}>
            <InputLabel>Role</InputLabel>
            <Select value={userForm.role} label="Role" onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setUserDialog(false); setEditUser(null); }}>Cancel</Button>
          <Button variant="contained" onClick={() => editUser ? updateUserMutation.mutate() : createUserMutation.mutate()}>
            {editUser ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity ?? 'info'} onClose={() => setSnackbar(null)}>
          {snackbar?.message ?? ''}
        </Alert>
      </Snackbar>
    </Box>
  );
}
