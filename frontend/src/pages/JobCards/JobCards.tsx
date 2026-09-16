import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  Box, Card, Typography, TextField, MenuItem, Button, Table, TableHead, TableRow,
  TableBody, TableCell, TableContainer, TablePagination, IconButton, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { fetchJobCards } from '../../redux/jobSlice';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import Loader from '../../components/Loader';
import { formatDate } from '../../utils/format';

const STATUS_OPTIONS = ['New', 'In Progress', 'Pending Parts', 'Pending Approval', 'Ready for Delivery', 'Delivered', 'On Hold', 'Cancelled'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

export default function JobCards() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, pagination, loading } = useAppSelector((state) => state.jobCards);

  const [filters, setFilters] = useState({ status: '', priority: '', q: '', type: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    dispatch(fetchJobCards({ ...filters, page: page + 1, limit: rowsPerPage }));
  }, [dispatch, filters, page, rowsPerPage]);

  const handleFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Job Cards</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Track and manage all workshop job cards</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/jobcards/new')}>
          New Job Card
        </Button>
      </Box>

      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            size="small"
            label="Search"
            value={filters.q}
            onChange={(e) => handleFilter('q', e.target.value)}
            placeholder="Job #, Reg No., Customer"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select size="small" label="Status" value={filters.status}
            onChange={(e) => handleFilter('status', e.target.value)} sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField
            select size="small" label="Priority" value={filters.priority}
            onChange={(e) => handleFilter('priority', e.target.value)} sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {PRIORITY_OPTIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField
            select size="small" label="Service Type" value={filters.type}
            onChange={(e) => handleFilter('type', e.target.value)} sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {['Maintenance', 'Repair', 'Paint', 'Inspection', 'Alignment', 'Diagnostics', 'Detailing', 'Other'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
        </Box>
      </Card>

      <Card>
        {loading ? (
          <Loader label="Loading job cards..." />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Job #</TableCell>
                  <TableCell>Reg No.</TableCell>
                  <TableCell>Vehicle</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Est. Delivery</TableCell>
                  <TableCell>Advisor</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((jc) => (
                  <TableRow key={jc._id} hover>
                    <TableCell>{jc.jobCardNumber}</TableCell>
                    <TableCell>{jc.vehicle?.registrationNumber}</TableCell>
                    <TableCell>{jc.vehicle?.make} {jc.vehicle?.model} ({jc.vehicle?.year})</TableCell>
                    <TableCell>
                      <Typography variant="body2">{jc.customer?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{jc.customer?.phone}</Typography>
                    </TableCell>
                    <TableCell>{jc.service?.type}</TableCell>
                    <TableCell><StatusBadge status={jc.status} /></TableCell>
                    <TableCell><PriorityBadge priority={jc.service?.priority} /></TableCell>
                    <TableCell>{formatDate(jc.service?.estimatedDelivery)}</TableCell>
                    <TableCell>{jc.advisor?.name || '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => navigate(`/jobcards/${jc._id}`)} title="View">
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => navigate(`/jobcards/${jc._id}/edit`)} title="Edit">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" color="text.secondary">No job cards found.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          component="div"
          count={pagination.total}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Card>
    </Box>
  );
}