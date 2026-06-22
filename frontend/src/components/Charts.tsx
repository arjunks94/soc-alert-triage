import { Fragment } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { getClassificationColor } from '../utils/classificationColors';
import { severityColors } from '../theme';

interface SeverityPieProps {
  data: { name: string; value: number }[];
  title?: string;
  onSegmentClick?: (name: string) => void;
  activeSegment?: string;
  bare?: boolean;
}

export function SeverityPieChart({
  data,
  title = 'Alert Severity Distribution',
  onSegmentClick,
  activeSegment,
  bare = false,
}: SeverityPieProps) {
  const chart = (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          onClick={(_, index) => {
            const entry = data[index];
            if (entry && onSegmentClick) onSegmentClick(entry.name);
          }}
          style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
        >
          {data.map((entry) => {
            const color = getClassificationColor(entry.name);
            const isActive = !activeSegment || activeSegment === entry.name;
            return (
              <Cell
                key={entry.name}
                fill={color}
                stroke={activeSegment === entry.name ? '#fff' : color}
                strokeWidth={activeSegment === entry.name ? 3 : 1}
                opacity={isActive ? 1 : 0.35}
              />
            );
          })}
        </Pie>
        <Tooltip formatter={(value: number, name: string) => [value, name]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  if (bare) return chart;

  return (
    <Card>
      <CardContent>
        {title && <Typography variant="h6" gutterBottom>{title}</Typography>}
        {chart}
      </CardContent>
    </Card>
  );
}

interface TimelineChartProps {
  data: { hour: string; critical: number; high: number; medium: number; low: number }[];
  title?: string;
}

export function AlertsTimelineChart({ data, title = 'Alerts Per Hour' }: TimelineChartProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Legend />
            <Bar dataKey="critical" stackId="a" fill={severityColors.CRITICAL} />
            <Bar dataKey="high" stackId="a" fill={severityColors.HIGH} />
            <Bar dataKey="medium" stackId="a" fill={severityColors.MEDIUM} />
            <Bar dataKey="low" stackId="a" fill={severityColors.LOW} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface HeatmapProps {
  data: { tactic: string; technique: string; count: number }[];
}

export function MitreHeatmap({ data }: HeatmapProps) {
  if (!data.length) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>MITRE ATT&CK Heatmap</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No MITRE mapping data yet. Run a SentinelOne sync to populate tactics and techniques.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const tactics = [...new Set(data.map((d) => d.tactic))].slice(0, 8);
  const techniques = [...new Set(data.map((d) => d.technique))].slice(0, 10);

  const getCount = (tactic: string, technique: string) =>
    data.find((d) => d.tactic === tactic && d.technique === technique)?.count || 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>MITRE ATT&CK Heatmap</Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `120px repeat(${techniques.length}, 1fr)`, gap: 0.5, minWidth: 600 }}>
            <Box />
            {techniques.map((t) => (
              <Typography key={t} variant="caption" sx={{ textAlign: 'center', fontSize: '0.6rem', transform: 'rotate(-45deg)' }}>
                {t.slice(0, 12)}
              </Typography>
            ))}
            {tactics.map((tactic) => (
              <Fragment key={tactic}>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', pr: 1 }}>
                  {tactic.slice(0, 16)}
                </Typography>
                {techniques.map((technique) => {
                  const count = getCount(tactic, technique);
                  const intensity = count / maxCount;
                  return (
                    <Box
                      key={`${tactic}-${technique}`}
                      sx={{
                        bgcolor: count > 0 ? `rgba(239, 68, 68, ${0.2 + intensity * 0.8})` : 'rgba(255,255,255,0.03)',
                        borderRadius: 1,
                        p: 0.5,
                        textAlign: 'center',
                        minHeight: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`${tactic} / ${technique}: ${count}`}
                    >
                      {count > 0 && (
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                          {count}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Fragment>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

interface WorkloadChartProps {
  data: { name: string; alert_count: number }[];
}

export function AnalystWorkloadChart({ data }: WorkloadChartProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Analyst Workload</Typography>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Bar dataKey="alert_count" fill="#00bcd4" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface EndpointTrendProps {
  data: { date: string; online: number; offline: number }[];
}

export function EndpointHealthTrend({ data }: EndpointTrendProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Endpoint Health Trend</Typography>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
            <Legend />
            <Line type="monotone" dataKey="online" stroke="#10b981" strokeWidth={2} />
            <Line type="monotone" dataKey="offline" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface IncidentDistProps {
  data: { name: string; value: number }[];
}

export function IncidentStatusChart({ data }: IncidentDistProps) {
  const colors = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#6b7280'];
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Incident Status Distribution</Typography>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={90} dataKey="value" label>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
