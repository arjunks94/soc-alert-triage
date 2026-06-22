import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, threatsApi, alertsApi } from '../services/endpoints';
import { useWebSocket } from '../hooks/useWebSocket';
import { SyncRefreshButton } from '../components/SyncRefreshButton';
import { WallboardCenter } from '../components/wallboard/WallboardCenter';
import { WallboardThreatFeed } from '../components/wallboard/WallboardThreatFeed';
import { WallboardAttackTypes } from '../components/wallboard/WallboardAttackTypes';
import { WallboardMitreTactics } from '../components/wallboard/WallboardMitreTactics';
import {
  WallboardSystemOverview,
  WallboardTopAssets,
  WallboardSeverityDonut,
  WallboardActiveAlerts,
} from '../components/wallboard/WallboardRightColumn';
import { WallboardFooter } from '../components/wallboard/WallboardFooter';

const REFRESH_SECONDS = 15;

export function WallboardPage() {
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(new Date());
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [refreshing, setRefreshing] = useState(false);

  const refreshWallboard = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['wallboard'] });
    setCountdown(REFRESH_SECONDS);
    setRefreshing(false);
  }, [queryClient]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          queryClient.invalidateQueries({ queryKey: ['wallboard'] });
          return REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [queryClient]);

  useWebSocket('dashboard', (msg) => {
    if (msg.type === 'sync_complete') {
      queryClient.invalidateQueries({ queryKey: ['wallboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCountdown(REFRESH_SECONDS);
    }
  });

  const { data: summary } = useQuery({
    queryKey: ['wallboard', 'summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: threats } = useQuery({
    queryKey: ['wallboard', 'threats'],
    queryFn: () => dashboardApi.threats(12).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: heatmap } = useQuery({
    queryKey: ['wallboard', 'heatmap'],
    queryFn: () => dashboardApi.heatmap().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: topAssets } = useQuery({
    queryKey: ['wallboard', 'top-assets'],
    queryFn: () => dashboardApi.topAssets(6).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: timeline } = useQuery({
    queryKey: ['wallboard', 'timeline'],
    queryFn: () => dashboardApi.timeline(12).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: threatTypes } = useQuery({
    queryKey: ['wallboard', 'threat-types'],
    queryFn: () => threatsApi.list().then((r) => r.data.severity_distribution as Record<string, number>),
    refetchInterval: 30000,
  });

  const { data: contained } = useQuery({
    queryKey: ['wallboard', 'contained'],
    queryFn: () =>
      alertsApi.list({ status: 'CONTAINED', page_size: 1 }).then((r) => r.data.total),
    refetchInterval: 30000,
  });

  const sparkData = (timeline || []).map(
    (p) => p.critical + p.high + p.medium + p.low
  );

  const recentAlerts = (timeline || []).slice(-1).reduce(
    (sum, p) => sum + p.critical + p.high + p.medium + p.low,
    summary?.new_alerts ?? 0
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#020617',
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(30,58,138,0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 0% 100%, rgba(239,68,68,0.05) 0%, transparent 40%),
          radial-gradient(ellipse at 100% 100%, rgba(59,130,246,0.08) 0%, transparent 40%),
          #020617
        `,
        overflow: 'hidden',
      }}
    >
      {/* Top status bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 0.75,
          borderBottom: '1px solid rgba(59,130,246,0.15)',
          background: 'rgba(2,6,23,0.8)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              animation: 'blink 2s ease-in-out infinite',
              '@keyframes blink': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          <Typography sx={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#22c55e' }}>
            LIVE
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#3b82f6',
            letterSpacing: '0.05em',
          }}
        >
          {clock.toLocaleTimeString()}
        </Typography>
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
          NEXT REFRESH {countdown}s · AUTO 15s
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Refresh wallboard data now">
            <IconButton
              size="small"
              onClick={refreshWallboard}
              disabled={refreshing}
              sx={{ color: '#3b82f6' }}
            >
              <Refresh fontSize="small" sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />
            </IconButton>
          </Tooltip>
          <SyncRefreshButton size="small" label="Sync S1" />
        </Box>
      </Box>

      {/* Main 3-column grid */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1.2fr 1fr' },
          gap: 1.5,
          p: 1.5,
          minHeight: 0,
        }}
      >
        {/* Left column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
          <Box sx={{ flex: '1 1 40%', minHeight: 180 }}>
            <WallboardThreatFeed threats={threats || []} />
          </Box>
          <WallboardAttackTypes distribution={threatTypes || {}} />
          <WallboardMitreTactics heatmap={heatmap || []} />
        </Box>

        {/* Center column */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            minHeight: 400,
          }}
        >
          <Box
            sx={{
              flex: 1,
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '4px',
              background: `
                linear-gradient(rgba(59,130,246,0.02) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59,130,246,0.02) 1px, transparent 1px),
                radial-gradient(ellipse at center, rgba(30,58,138,0.2) 0%, transparent 70%)
              `,
              backgroundSize: '30px 30px, 30px 30px, 100% 100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Corner brackets */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <Box
                key={corner}
                sx={{
                  position: 'absolute',
                  width: 20,
                  height: 20,
                  borderColor: 'rgba(59,130,246,0.5)',
                  borderStyle: 'solid',
                  borderWidth: 0,
                  ...(corner === 'tl' && { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 }),
                  ...(corner === 'tr' && { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 }),
                  ...(corner === 'bl' && { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 }),
                  ...(corner === 'br' && { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }),
                }}
              />
            ))}
            <WallboardCenter />
          </Box>
        </Box>

        {/* Right column */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <WallboardSystemOverview
            summary={summary}
            timelineSpark={sparkData}
            containedCount={contained ?? 0}
          />
          <WallboardTopAssets assets={topAssets || []} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <WallboardSeverityDonut summary={summary} />
            <WallboardActiveAlerts count={recentAlerts} />
          </Box>
        </Box>
      </Box>

      <WallboardFooter />
    </Box>
  );
}
