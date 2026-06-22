import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, CircularProgress, Tooltip, Snackbar, Alert } from '@mui/material';
import { Sync } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi } from '../services/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';

interface SyncRefreshButtonProps {
  full?: boolean;
  label?: string;
  size?: 'small' | 'medium' | 'large';
}

export function SyncRefreshButton({
  full = false,
  label = 'Refresh from SentinelOne',
  size = 'medium',
}: SyncRefreshButtonProps) {
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finishSync = useCallback((counts?: Record<string, number>, err?: string) => {
    stopPolling();
    setSyncing(false);
    if (err) {
      setError(err);
      return;
    }
    setLastSync(new Date().toLocaleTimeString());
    setError(null);
    queryClient.invalidateQueries();
    if (counts) {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total === 0) {
        setError('Sync completed but no new records were returned from SentinelOne.');
      }
    }
  }, [queryClient, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await syncApi.status();
        if (!data.running) {
          if (data.error) {
            finishSync(undefined, data.error);
          } else {
            finishSync(data.counts ?? undefined);
          }
        }
      } catch {
        finishSync(undefined, 'Failed to check sync status');
      }
    }, 2000);
  }, [finishSync, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useWebSocket('dashboard', (msg) => {
    if (msg.type === 'sync_complete' && syncing) {
      finishSync();
    }
  });

  const mutation = useMutation({
    mutationFn: () => syncApi.trigger(full).then((r) => r.data),
    onSuccess: (data) => {
      if (data.status === 'running') {
        setSyncing(true);
        startPolling();
        return;
      }
      setSyncing(true);
      startPolling();
    },
    onError: (err: Error) => {
      setSyncing(false);
      setError(err.message || 'Sync request failed');
    },
  });

  return (
    <>
      <Tooltip
        title={
          lastSync
            ? `Last synced at ${lastSync}`
            : 'Fetch latest alerts, threats, endpoints, and events from SentinelOne'
        }
      >
        <span>
          <Button
            variant="outlined"
            size={size}
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <Sync />}
            onClick={() => mutation.mutate()}
            disabled={syncing}
            sx={{
              borderColor: 'rgba(59,130,246,0.4)',
              color: '#3b82f6',
              '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(59,130,246,0.08)' },
            }}
          >
            {syncing ? 'Syncing...' : label}
          </Button>
        </span>
      </Tooltip>
      <Snackbar open={!!error} autoHideDuration={8000} onClose={() => setError(null)}>
        <Alert severity={error?.includes('completed') ? 'info' : 'error'} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
