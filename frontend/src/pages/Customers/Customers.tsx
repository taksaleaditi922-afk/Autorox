import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, TextField, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TablePagination, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../services/api';
import Loader from '../../components/Loader';
import { formatDate } from '../../utils/format';

export default function Customers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/customers', { params: { q, page: page + 1, limit: rowsPerPage } });
      setData(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q, page, rowsPerPage]);

  return (
    <Box>
      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Customers</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Manage your customer directory</Typography>
      </Box>
      <Card sx={{ mb: 2, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small" label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Name, email, phone" sx={{ flexGrow: 1, minWidth: 220 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        />
        <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
      </Card>
      <Card>
        {loading ? <Loader label="Loading customers..." /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell><TableCell>Phone</TableCell><TableCell>Email</TableCell>
                  <TableCell>City</TableCell><TableCell>Vehicles</TableCell><TableCell>Job Cards</TableCell>
                  <TableCell>Last Service</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c._id} hover>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.email || '—'}</TableCell>
                    <TableCell>{c.city || '—'}</TableCell>
                    <TableCell>{c.vehicles?.length || 0}</TableCell>
                    <TableCell>{c.totalJobCards || 0}</TableCell>
                    <TableCell>{formatDate(c.lastServiceDate)}</TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" color="text.secondary">No customers found.</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination component="div" count={total} page={page} onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />
      </Card>
    </Box>
  );
}