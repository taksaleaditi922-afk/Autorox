import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, TextField, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, InputAdornment, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../services/api';
import Loader from '../../components/Loader';
import { formatDate } from '../../utils/format';

export default function Vehicles() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/vehicles', { params: { q, limit: 100 } });
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Vehicle Registry</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Browse all registered vehicles</Typography>
      </Box>
      <Card sx={{ mb: 2, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Reg No., make, model, VIN" sx={{ flexGrow: 1, minWidth: 220 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        />
        <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
      </Card>
      <Card>
        {loading ? <Loader label="Loading vehicles..." /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reg No.</TableCell><TableCell>Vehicle</TableCell><TableCell>Year</TableCell>
                  <TableCell>Color</TableCell><TableCell>Fuel</TableCell><TableCell>Owner</TableCell>
                  <TableCell>Service Count</TableCell><TableCell>Last Service</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((v) => (
                  <TableRow key={v._id} hover>
                    <TableCell>{v.registrationNumber}</TableCell>
                    <TableCell>{v.make} {v.model}</TableCell>
                    <TableCell>{v.year}</TableCell>
                    <TableCell>{v.color || '—'}</TableCell>
                    <TableCell>{v.fuelType || '—'}</TableCell>
                    <TableCell>{v.owner?.name || '—'}</TableCell>
                    <TableCell>{v.totalServiceCount || 0}</TableCell>
                    <TableCell>{formatDate(v.lastServiceDate)}</TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" color="text.secondary">No vehicles found.</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}