import { useEffect, useState } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, MenuItem, TextField,
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend, LineChart, Line,
} from 'recharts';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import api from '../../services/api';
import Loader from '../../components/Loader';
import KpiCard from '../../components/Dashboard/KpiCard';
import useT from '../../i18n/useT';

const STATUS_COLORS = {
  New: '#2563eb',
  'In Progress': '#f59e0b',
  'Pending Parts': '#f97316',
  'Pending Approval': '#8b5cf6',
  'Ready for Delivery': '#06b6d4',
  Delivered: '#16a34a',
  'On Hold': '#dc2626',
  Cancelled: '#6b7280',
};

export default function Dashboard() {
  const t = useT();
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/analytics/dashboard', { params: { days: range } });
        setData(res.data.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || t('common.failedDashboard'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range]);

  if (loading) return <Loader label={t('common.loadingDashboard')} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!data) return null;

  const statusData = Object.entries(data.statusDistribution || {}).map(([name, value]) => ({ name, value }));
  const serviceData = Object.entries(data.serviceTypeDistribution || {}).map(([name, value]) => ({ name, value }));
  const trendData = (data.trend || []).map((t) => ({ date: t.date.slice(5), count: t.count }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('dashboard.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{t('dashboard.subtitle')}</Typography>
        </Box>
        <TextField
          select size="small" value={range}
          onChange={(e) => setRange(e.target.value)}
          label={t('dashboard.dateRange')} sx={{ minWidth: 150 }}
        >
          <MenuItem value={7}>{t('dashboard.last7')}</MenuItem>
          <MenuItem value={30}>{t('dashboard.last30')}</MenuItem>
          <MenuItem value={90}>{t('dashboard.last90')}</MenuItem>
        </TextField>
      </Box>

      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label={t('dashboard.totalActive')} value={data.kpis.totalActive} icon={<AssignmentIcon fontSize="small" />} color="#0f172a" gradient="linear-gradient(135deg, #0f172a 0%, #334155 100%)" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label={t('dashboard.pendingApprovals')} value={data.kpis.pendingApprovals} icon={<PendingActionsIcon fontSize="small" />} color="#f59e0b" gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label={t('dashboard.completedToday')} value={data.kpis.completedToday} icon={<AssignmentTurnedInIcon fontSize="small" />} color="#10b981" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label={t('dashboard.avgTurnaround')} value={data.kpis.averageTurnaroundHours != null ? `${data.kpis.averageTurnaroundHours}h` : '—'} sub={t('dashboard.perCompletedJob')} icon={<ScheduleIcon fontSize="small" />} color="#3b82f6" gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14 }}>📊</span>
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>{t('dashboard.statusDistribution')}</Typography>
              </Box>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" label>{statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                    ))}</Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: 'info.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUpIcon fontSize="small" sx={{ color: 'white' }} />
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>{t('dashboard.jobCardTrend', { days: range })}</Typography>
              </Box>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="count" stroke="#0f172a" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: 'secondary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14 }}>📈</span>
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>{t('dashboard.serviceTypeDistribution')}</Typography>
              </Box>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#334155" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>{t('dashboard.statusSummary')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {statusData.filter((s) => s.value > 0).map((s) => (
                  <Chip key={s.name} label={`${s.name}: ${s.value}`} size="small" sx={{ bgcolor: STATUS_COLORS[s.name], color: 'white', fontWeight: 600 }} />
                ))}
                {statusData.every((s) => s.value === 0) && (
                  <Typography variant="body2" color="text.secondary">{t('dashboard.noJobCards')}</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}