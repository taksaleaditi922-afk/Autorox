// ---------------------------------------------------------------------------
// Estimates list — entry point into the 4-step estimate workflow.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/uiSlice';
import * as estimateService from '../../services/estimate/estimateService';
import { ESTIMATE_STATUSES, STATUS_COLORS } from '../../services/estimate/config';
import Loader from '../../components/Loader';
import { EmptyState, StatusChip } from '../../components/estimate/primitives';
import { formatDate } from '../../utils/format';
import { formatMoney } from '../../utils/estimateMath';
import { useDebounce } from '../../utils/useDebounce';

export default function Estimates() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const debouncedQ = useDebounce(q, 400);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await estimateService.listEstimates({
        q: debouncedQ,
        status: status || undefined,
        page: page + 1,
        limit: rowsPerPage,
      });
      setRows(res.data);
      setTotal(res.pagination.total);
    } catch (err: any) {
      setRows([]);
      setTotal(0);
      setError(err?.response?.data?.error || 'Could not load estimates. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, status, page, rowsPerPage]);

  useEffect(() => {
    void load();
  }, [load]);

  // Warm the wizard bundle while the browser is idle so "New Estimate" opens
  // without waiting on a chunk download.
  useEffect(() => {
    const preload = () => void import('../EstimateWizard/EstimateWizard');
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(preload, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const grandTotal = (doc: any) => doc?.totals?.grandTotal ?? doc?.grandTotal ?? 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Estimates
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Build, review and share vehicle service quotations
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/estimates/new')}>
          New Estimate
        </Button>
      </Box>

      <Card sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Estimate number, customer, phone or registration"
          sx={{ flexGrow: 1, minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {ESTIMATE_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
          <MenuItem value="Approved">Approved</MenuItem>
          <MenuItem value="Converted to Invoice">Converted to Invoice</MenuItem>
        </TextField>
        <Button startIcon={<RefreshIcon />} onClick={() => void load()}>
          Refresh
        </Button>
      </Card>

      {error && (
        <Card sx={{ p: 2, mb: 2, borderLeft: '4px solid', borderColor: 'error.main' }}>
          <Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
            {error}
          </Typography>
          <Button size="small" onClick={() => void load()}>
            Try again
          </Button>
        </Card>
      )}

      <Card>
        {loading ? (
          <Loader label="Loading estimates..." />
        ) : rows.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              title="No estimates yet"
              description="Start a new estimate to capture the vehicle, run an inspection and quote the work."
              action={
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    navigate('/estimates/new');
                    dispatch(showToast({ severity: 'info', message: 'Starting a new estimate draft' }));
                  }}
                >
                  Create Estimate
                </Button>
              }
            />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Estimate #</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Grand Total</TableCell>
                    <TableCell>Valid Until</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const vehicleLabel = [row.vehicle?.brand, row.vehicle?.model].filter(Boolean).join(' ');
                    return (
                      <TableRow key={row._id || row.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {row.estimateNumber}
                          </Typography>
                          {row.jobCardId?.jobCardNumber && (
                            <Typography variant="caption" color="text.secondary">
                              Job card {row.jobCardId.jobCardNumber}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.customer?.name || row.jobCardId?.customer?.name || '—'}
                          {row.customer?.phone && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {row.customer.phone}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.vehicle?.registrationNumber || row.jobCardId?.vehicle?.registrationNumber || '—'}
                          {vehicleLabel && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {vehicleLabel}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.status}
                            color={(STATUS_COLORS[row.status] as any) || 'default'}
                            variant={STATUS_COLORS[row.status] === 'default' ? 'outlined' : 'filled'}
                          />
                        </TableCell>
                        <TableCell align="right">{formatMoney(grandTotal(row))}</TableCell>
                        <TableCell>{formatDate(row.metadata?.validUntil || row.validUntil)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                            onClick={() => navigate(`/estimates/${row._id || row.id}`)}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_e, next) => setPage(next)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </>
        )}
      </Card>

      <Box sx={{ mt: 2 }}>
        <StatusChip label="Tip: drafts autosave while you work" color="info" />
      </Box>
    </Box>
  );
}
