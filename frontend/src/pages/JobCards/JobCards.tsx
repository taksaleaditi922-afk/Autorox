import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Rating,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ChecklistIcon from '@mui/icons-material/Checklist';
import RateReviewIcon from '@mui/icons-material/RateReview';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentsIcon from '@mui/icons-material/Payments';
import { fetchJobCards, fetchJobCardStats, updateJobCard, deleteJobCard, type JobCardStats } from '../../redux/jobSlice';
import { showToast } from '../../redux/uiSlice';
import type { RootState, AppDispatch } from '../../store/store';
import StatusBadge from '../../components/StatusBadge';
import Loader from '../../components/Loader';
import JobCardDocumentsMenu from '../../components/jobCard/JobCardDocumentsMenu';
import PaymentStatusDialog from '../../components/jobCard/PaymentStatusDialog';
import { JOB_CARD_DOCUMENTS, openJobCardDocument } from '../../services/jobCard/documentService';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { useDebounce } from '../../utils/useDebounce';
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUSES, PAYMENT_MODES, SERVICE_TYPE_OPTIONS, STATUS_TABS } from '../../utils/jobCard';

const emptyStats: JobCardStats = { total: 0, byStatus: {}, groups: {} };

// The payments dialog only needs the advance receipt from the document menu.
const RECEIPT_DOCUMENTS = JOB_CARD_DOCUMENTS.filter((doc) => doc.id === 'advance-receipt');

const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const hasIssuedInvoice = (jc: any) => ['Issued', 'Paid', 'Sent'].includes(jc?.invoice?.status);

export default function JobCards() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, pagination, loading } = useSelector((state) => state.jobCards);

  const [filters, setFilters] = useState({ status: '', priority: '', q: '', type: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [receiptFor, setReceiptFor] = useState<any | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<any | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<{ rating: number; comment: string }>({ rating: 0, comment: '' });
  // Payment status edit
  const [paymentStatusFor, setPaymentStatusFor] = useState<any | null>(null);
  const [paymentStatusBusy, setPaymentStatusBusy] = useState(false);
  // Delete confirmation
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<any | null>(null);
  const [deleteForceConfirm, setDeleteForceConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const debouncedSearch = useDebounce(search, 350);
  const tab = STATUS_TABS[activeTab];
  const counts = stats || emptyStats;

  useEffect(() => {
    void dispatch(fetchJobCardStats());
  }, [dispatch]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, type, activeTab]);

  useEffect(() => {
    const params: Record<string, unknown> = { page: page + 1, limit: rowsPerPage };
    if (tab.statuses.length) params.status = tab.statuses.join(',');
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (type) params.type = type;
    void dispatch(fetchJobCards(params));
  }, [dispatch, page, rowsPerPage, debouncedSearch, type, tab.statuses]);

  const tabCount = (key: string) => counts.groups?.[key] ?? 0;

  const openFeedback = (jc: any) => {
    setFeedbackFor(jc);
    setFeedbackDraft({ rating: jc.feedback?.rating || 0, comment: jc.feedback?.comment || '' });
  };

  const patchJobCard = async (id: string, payload: Record<string, unknown>, successMessage: string) => {
    const res: any = await dispatch(updateJobCard({ id, payload }));
    if (updateJobCard.fulfilled.match(res)) {
      dispatch(showToast({ severity: 'success', message: successMessage }));
      void dispatch(fetchJobCardStats());
      void dispatch(fetchJobCards({ page: page + 1, limit: rowsPerPage, ...(tab.statuses.length ? { status: tab.statuses.join(',') } : {}) }));
      return true;
    }
    dispatch(showToast({ severity: 'error', message: res.payload || 'Could not update the job card' }));
    return false;
  };

  const handleRequestFeedback = async (jc: any) => {
    const ok = await patchJobCard(
      jc._id,
      { feedback: { ...(jc.feedback || {}), requestedAt: new Date().toISOString() } },
      `Feedback requested from ${jc.customer?.name || 'the customer'}`
    );
    if (ok) setFeedbackFor(null);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackFor) return;
    const ok = await patchJobCard(
      feedbackFor._id,
      {
        feedback: {
          ...(feedbackFor.feedback || {}),
          rating: feedbackDraft.rating,
          comment: feedbackDraft.comment,
          givenAt: new Date().toISOString(),
        },
      },
      'Customer feedback saved'
    );
    if (ok) setFeedbackFor(null);
  };

  const handleGatePass = async (jc: any) => {
    if (jc.gatePass?.createdAt) {
      try {
        openJobCardDocument('gate-pass', jc);
      } catch (err: any) {
        dispatch(showToast({ severity: 'error', message: err?.message || 'Could not open the gate pass' }));
      }
      return;
    }
    await patchJobCard(
      jc._id,
      {
        gatePass: {
          number: `GP-${jc.jobCardNumber || 'JC'}-${Date.now().toString().slice(-5)}`,
          createdAt: new Date().toISOString(),
        },
      },
      'Gate pass generated'
    );
  };

  // Payment status edit handlers
  const openPaymentStatusDialog = (jc: any) => {
    const total = jc.grandTotal || jc.orderSummary?.total || 0;
    const advanceDeducted = jc.advance?.amount || jc.orderSummary?.advanceDeducted || 0;
    const balanceDue = Math.max(total - advanceDeducted, 0);
    const today = new Date().toISOString().split('T')[0];
    setPaymentStatusFor({
      ...jc,
      total,
      balanceDue,
      initialValues: {
        paymentStatus: jc.paymentStatus || 'Pending',
        amountPaid: String(advanceDeducted),
        paymentMode: jc.advance?.paymentMode || 'Cash',
        paymentDate: jc.advance?.recordedAt ? jc.advance.recordedAt.split('T')[0] : today,
        reference: jc.advance?.reference || '',
      },
    });
  };

  const closePaymentStatusDialog = () => {
    setPaymentStatusFor(null);
  };

  const handlePaymentStatusSave = async (values: any) => {
    if (!paymentStatusFor) return false;
    setPaymentStatusBusy(true);
    try {
      const jc = paymentStatusFor;
      const total = jc.total;
      const amountPaid = Number(values.amountPaid) || 0;
      const newPaymentStatus = values.paymentStatus;
      const balanceDue = Math.max(total - amountPaid, 0);

      // Optimistically update UI
      const optimisticItem = { ...jc, paymentStatus: newPaymentStatus, advance: { amount: amountPaid, paymentMode: values.paymentMode, reference: values.reference, recordedAt: values.paymentDate } };
      const idx = items.findIndex((i) => i._id === jc._id);
      if (idx !== -1) {
        // We'll let the server response update via patchJobCard
      }

      const res: any = await dispatch(updateJobCard({ id: jc._id, payload: { paymentStatus: newPaymentStatus, advance: { amount: amountPaid, paymentMode: values.paymentMode, reference: values.reference, recordedAt: values.paymentDate } } }));
      if (updateJobCard.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Payment status updated' }));
        void dispatch(fetchJobCardStats());
        void dispatch(fetchJobCards({ page: page + 1, limit: rowsPerPage, ...(tab.statuses.length ? { status: tab.statuses.join(',') } : {}) }));
        closePaymentStatusDialog();
        return true;
      }
      dispatch(showToast({ severity: 'error', message: res.payload || 'Could not update payment status' }));
      return false;
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.message || 'Could not update payment status' }));
      return false;
    } finally {
      setPaymentStatusBusy(false);
    }
  };

  // Delete handlers
  const isDeleteAllowed = (jc: any) => {
    const allowedStatuses = ['New', 'Cancelled'];
    return allowedStatuses.includes(jc.status) || jc.isDraft === true;
  };

  const isAdmin = user?.role === 'Admin';

  const openDeleteConfirm = (jc: any) => {
    setDeleteConfirmFor(jc);
    setDeleteForceConfirm(false);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmFor(null);
    setDeleteForceConfirm(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirmFor || deleteBusy) return;
    const jc = deleteConfirmFor;
    const allowed = isDeleteAllowed(jc);
    const forceDelete = isAdmin && deleteForceConfirm;

    if (!allowed && !forceDelete) {
      dispatch(showToast({ severity: 'error', message: 'Delete not allowed for this job card status' }));
      return;
    }

    setDeleteBusy(true);
    try {
      const res: any = await dispatch(deleteJobCard({ id: jc._id, force: forceDelete }));
      if (deleteJobCard.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Job card deleted' }));
        void dispatch(fetchJobCardStats());
        void dispatch(fetchJobCards({ page: page + 1, limit: rowsPerPage, ...(tab.statuses.length ? { status: tab.statuses.join(',') } : {}) }));
        closeDeleteConfirm();
      } else {
        dispatch(showToast({ severity: 'error', message: res.payload || 'Could not delete job card' }));
      }
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.message || 'Could not delete job card' }));
    } finally {
      setDeleteBusy(false);
    }
  };

  const totals = useMemo(() => counts.total, [counts.total]);

  return (
    <Box>
      {/* ------------------------------- header ------------------------------- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Job Card
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Track every vehicle service from intake to delivery
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/jobcards/new')}>
          Add New
        </Button>
      </Box>

      {/* ---------------------------- status filter --------------------------- */}
      <Card sx={{ position: 'sticky', top: { xs: 64, sm: 72 }, zIndex: 3, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_e, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          {STATUS_TABS.map((statusTab) => {
            const count = tabCount(statusTab.key);
            return (
              <Tab
                key={statusTab.key}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <span>{statusTab.label}</span>
                    <Chip
                      size="small"
                      label={count}
                      color={activeTab === STATUS_TABS.indexOf(statusTab) ? 'primary' : 'default'}
                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                    />
                  </Box>
                }
              />
            );
          })}
        </Tabs>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', p: 2 }}>
          <Chip color="primary" variant="outlined" label={`Total ${totals} Bookings`} sx={{ fontWeight: 700 }} />
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, vehicle no. or chassis no."
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
            label="Service Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All</MenuItem>
            {SERVICE_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Card>

      {/* ------------------------------- table -------------------------------- */}
      <Card>
        {loading ? (
          <Loader label="Loading job cards..." />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1400 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Customer / Company</TableCell>
                  <TableCell>Contact Number</TableCell>
                  <TableCell>Vehicle No. / Chassis No.</TableCell>
                  <TableCell>Vehicle Details</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Payment Status</TableCell>
                  <TableCell>Payment Receipt &amp; History</TableCell>
                  <TableCell>Inspection Report</TableCell>
                  <TableCell>Feedback</TableCell>
                  <TableCell>Gate Pass</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((jc) => {
                  const paymentColor = PAYMENT_STATUS_COLORS[jc.paymentStatus] || 'default';
                  return (
                    <TableRow
                      key={jc._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/jobcards/${jc._id}`)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                            {initials(jc.customer?.name)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {jc.customer?.name || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {jc.customer?.type || 'Individual'} · {jc.jobCardNumber}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {jc.customer?.phone ? (
                          <Link href={`tel:${jc.customer.phone}`} underline="hover">
                            {jc.customer.phone}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {jc.vehicle?.registrationNumber || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {jc.vehicle?.chassisNumber || jc.vehicle?.vin || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {[jc.vehicle?.make, jc.vehicle?.model].filter(Boolean).join(' ') || '—'}
                        {jc.vehicle?.year ? ` (${jc.vehicle.year})` : ''}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {jc.vehicle?.fuelType || '—'} · {jc.vehicle?.odometerReading ?? '—'} km
                        </Typography>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          variant={hasIssuedInvoice(jc) ? 'outlined' : 'contained'}
                          onClick={() => navigate(hasIssuedInvoice(jc) ? `/jobcards/${jc._id}` : `/jobcards/${jc._id}/edit?step=4`)}
                        >
                          {hasIssuedInvoice(jc) ? 'View' : 'Continue'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={jc.source || 'N/A'} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip size="small" color={paymentColor as any} label={jc.paymentStatus || 'Pending'} />
                          <Tooltip title="Edit payment status">
                            <IconButton
                              size="small"
                              aria-label="Edit payment status"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentStatusDialog(jc);
                              }}
                              sx={{ bgcolor: 'warning.light', color: 'warning.dark', '&:hover': { bgcolor: 'warning.dark', color: 'white' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button size="small" startIcon={<PaymentsIcon fontSize="small" />} onClick={() => setReceiptFor(jc)}>
                          History
                        </Button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          startIcon={<ChecklistIcon fontSize="small" />}
                          onClick={() => navigate(`/jobcards/${jc._id}/edit?step=1`)}
                        >
                          {jc.inspectionReport?.length ? `${jc.inspectionReport.length} points` : 'Add'}
                        </Button>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" startIcon={<RateReviewIcon fontSize="small" />} onClick={() => openFeedback(jc)}>
                            {jc.feedback?.givenAt ? 'View' : 'Request'}
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          variant={jc.gatePass?.createdAt ? 'outlined' : 'text'}
                          startIcon={<LocalShippingIcon fontSize="small" />}
                          onClick={() => handleGatePass(jc)}
                        >
                          {jc.gatePass?.createdAt ? 'Print' : 'Create'}
                        </Button>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="View job card">
                          <IconButton size="small" onClick={() => navigate(`/jobcards/${jc._id}`)}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit job card">
                          <IconButton size="small" onClick={() => navigate(`/jobcards/${jc._id}/edit`)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Job Card">
                          <IconButton
                            size="small"
                            aria-label="Delete Job Card"
                            onClick={() => openDeleteConfirm(jc)}
                            disabled={!isDeleteAllowed(jc) && !isAdmin}
                            sx={{
                              bgcolor: 'error.light',
                              color: 'error.dark',
                              '&:hover': { bgcolor: 'error.dark', color: 'white' },
                              '&.Mui-disabled': {
                                bgcolor: 'grey.200',
                                color: 'grey.400',
                                cursor: 'not-allowed',
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" color="text.secondary">
                        No job cards found.
                      </Typography>
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
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Card>

      {/* --------------------------- receipt dialog --------------------------- */}
      <Dialog open={Boolean(receiptFor)} onClose={() => setReceiptFor(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          Payment Receipt &amp; History
          {receiptFor?.jobCardNumber ? ` · ${receiptFor.jobCardNumber}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {receiptFor && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {receiptFor.customer?.name} · {receiptFor.vehicle?.registrationNumber}
                </Typography>
                <Chip
                  size="small"
                  color={(PAYMENT_STATUS_COLORS[receiptFor.paymentStatus] || 'default') as any}
                  label={receiptFor.paymentStatus || 'Pending'}
                />
              </Box>
              <Stack spacing={1}>
                <Line label="Subtotal" value={formatCurrency(receiptFor.orderSummary?.subtotal || 0)} />
                <Line label="Discount" value={`- ${formatCurrency(receiptFor.orderSummary?.discount || 0)}`} />
                <Line label="Tax" value={formatCurrency(receiptFor.orderSummary?.tax || 0)} />
                <Divider />
                <Line label="Order Total" value={formatCurrency(receiptFor.orderSummary?.total || 0)} strong />
                <Line label="Advance Paid" value={formatCurrency(receiptFor.orderSummary?.advanceDeducted || 0)} />
                <Line label="Balance Due" value={formatCurrency(receiptFor.orderSummary?.balanceDue || 0)} strong />
              </Stack>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
                Transactions
              </Typography>
              {receiptFor.orderSummary?.advanceDeducted ? (
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Advance received
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {receiptFor.intake?.advancePaymentMode || 'Cash'} ·{' '}
                        {formatDate(receiptFor.createdAt)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700}>
                      {formatCurrency(receiptFor.orderSummary.advanceDeducted)}
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No payments recorded yet.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {receiptFor && <JobCardDocumentsMenu jobCard={receiptFor} label="Print Receipt" documents={RECEIPT_DOCUMENTS} />}
          <Button variant="contained" onClick={() => setReceiptFor(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* --------------------------- feedback dialog -------------------------- */}
      <Dialog open={Boolean(feedbackFor)} onClose={() => setFeedbackFor(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Customer Feedback</DialogTitle>
        <DialogContent dividers>
          {feedbackFor && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {feedbackFor.customer?.name} · {feedbackFor.vehicle?.registrationNumber}
              </Typography>
              {feedbackFor.feedback?.requestedAt && (
                <Chip
                  size="small"
                  color="info"
                  variant="outlined"
                  label={`Requested ${formatDateTime(feedbackFor.feedback.requestedAt)}`}
                  sx={{ mb: 2 }}
                />
              )}
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                Rating
              </Typography>
              <Rating
                value={feedbackDraft.rating}
                onChange={(_e, value) => setFeedbackDraft((d) => ({ ...d, rating: value || 0 }))}
              />
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Comments"
                value={feedbackDraft.comment}
                onChange={(e) => setFeedbackDraft((d) => ({ ...d, comment: e.target.value }))}
                margin="normal"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => feedbackFor && handleRequestFeedback(feedbackFor)}>Request Feedback</Button>
          <Box>
            <Button onClick={() => setFeedbackFor(null)}>Cancel</Button>
            <Button variant="contained" startIcon={<ReceiptLongIcon />} onClick={handleSaveFeedback}>
              Save Feedback
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* ----------------------- payment status dialog ----------------------- */}
      <PaymentStatusDialog
        open={Boolean(paymentStatusFor)}
        values={
          paymentStatusFor?.initialValues || {
            paymentStatus: 'Pending',
            amountPaid: '0',
            paymentMode: 'Cash',
            paymentDate: '',
            reference: '',
          }
        }
        total={paymentStatusFor?.total || 0}
        balanceDue={paymentStatusFor?.balanceDue || 0}
        busy={paymentStatusBusy}
        onClose={closePaymentStatusDialog}
        onSave={handlePaymentStatusSave}
      />

      {/* ------------------------ delete confirmation ------------------------ */}
      <Dialog open={Boolean(deleteConfirmFor)} onClose={closeDeleteConfirm} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Job Card</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: deleteConfirmFor && !isDeleteAllowed(deleteConfirmFor) ? 2 : 0 }}>
            Delete job card {deleteConfirmFor?.jobCardNumber}
            {deleteConfirmFor?.customer?.name ? ` for ${deleteConfirmFor.customer.name}` : ''}? This
            action cannot be undone.
          </Typography>
          {deleteConfirmFor && !isDeleteAllowed(deleteConfirmFor) && (
            isAdmin ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={deleteForceConfirm}
                    onChange={(e) => setDeleteForceConfirm(e.target.checked)}
                    color="error"
                  />
                }
                label="Force delete this in-progress job card (Admin)"
              />
            ) : (
              <Alert severity="warning">Only draft, New or Cancelled job cards can be deleted.</Alert>
            )
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDeleteConfirm} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteBusy || (!isDeleteAllowed(deleteConfirmFor || {}) && !(isAdmin && deleteForceConfirm))}
          >
            {deleteBusy ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 700 : 400}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 700 : 500}>
        {value}
      </Typography>
    </Box>
  );
}
