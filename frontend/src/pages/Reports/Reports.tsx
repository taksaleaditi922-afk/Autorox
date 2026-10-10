import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import Loader from '../../components/Loader';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';

export default function Reports() {
  const [rows, setRows] = useState([]);
  const [perf, setPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, perfRes] = await Promise.all([
        api.get('/reports/jobcards', { params: status ? { status } : {} }),
        api.get('/analytics/advisor-performance'),
      ]);
      setRows(reportRes.data.data || []);
      setPerf(perfRes.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const downloadCsv = async () => {
    try {
      const res = await api.get('/reports/jobcards', { params: { export: true, status }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'jobcards-report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to load data. Please try again.');
    }
  };

  const perfData = perf.map((p) => ({ name: p.advisor?.name, completed: p.completed, active: p.activeAssigned }));

  return (
    <Box>
      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
      <Typography variant="h5" fontWeight={700} mb={3}>Reports &amp; Analytics</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField select size="small" label="Status Filter" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ flexGrow: 1, minWidth: 200 }}>
          <MenuItem value="">All</MenuItem>
          {['New', 'In Progress', 'Pending Parts', 'Pending Approval', 'Ready for Delivery', 'Delivered', 'On Hold', 'Cancelled'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={downloadCsv}>Export CSV</Button>
      </Box>

      {loading ? <Loader label="Loading reports..." /> : (
<>
          <Card sx={{ mb: 2.5 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Advisor Performance</Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="completed" fill="#16a34a" name="Completed" />
                  <Bar dataKey="active" fill="#f59e0b" name="Active Assigned" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ pb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Job Card Report</Typography>
                  <Typography variant="caption" color="text.muted">{rows.length} records</Typography>
                </Box>
              </Box>
            </CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Job #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Reg No.</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Est. Delivery</TableCell>
                    <TableCell>Advisor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r._id} hover>
                      <TableCell>{r.jobCardNumber}</TableCell>
                      <TableCell>{r.customer?.name}</TableCell>
                      <TableCell>{r.vehicle?.registrationNumber}</TableCell>
                      <TableCell>{r.service?.type}</TableCell>
                      <TableCell><PriorityBadge priority={r.service?.priority} /></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        {r.service?.estimatedDelivery ? new Date(r.service.estimatedDelivery).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>{r.advisor?.name || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                        <Typography variant="body2" color="text.secondary">No records found.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Box>
  );
}
