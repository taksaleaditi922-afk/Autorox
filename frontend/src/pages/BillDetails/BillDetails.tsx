import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, Table, TableHead, TableRow,
  TableBody, TableCell, TableContainer, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Divider, Chip, TextField as MTextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Print as PrintIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { fetchSale, updateSale, deleteSale, updateSaleStatus, recordPayment, fetchPaymentHistory } from '../../redux/salesSlice';
import { showToast } from '../../redux/uiSlice';
import StatusBadge from '../../components/StatusBadge';
import Loader from '../../components/Loader';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/format';
import { SALE_STATUSES, PAYMENT_METHODS, TAX_RATE } from '../../constants';
import { invoiceFromSale, openInvoicePrint } from '../../services/invoicePrintService';

const ITEM_ROWS = [{ productId: '', productCode: '', productName: '', quantity: 1, unitPrice: 0, tax: TAX_RATE }];

export default function BillDetails() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { current, loading, paymentHistory } = useAppSelector((state) => state.sales);
  const { user } = useAppSelector((state) => state.auth);

  const [editing, setEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const [form, setForm] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [recordingDialog, setRecordingDialog] = useState(false);
  const [recordingAmount, setRecordingAmount] = useState(0);
  const [recordingMethod, setRecordingMethod] = useState('Cash');
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    dispatch(fetchSale(id));
    dispatch(fetchPaymentHistory(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (current && !editing) {
      setEditForm({
        customer: { ...current.customer },
        items: [...(current.items || [])],
        discount: { type: current.billing?.discountType || 'Fixed', value: current.billing?.discountValue || 0, reason: current.billing?.discountAmount || 0 },
        payment: { method: current.payment?.method || 'Cash', amountPaid: current.payment?.amountPaid || 0 },
        notes: current.notes || '',
        jobCardLinked: current.jobCardLinked || '',
      });
    }
  }, [current, editing]);

  const totals = (current) => {
    const b = current?.billing || {};
    return {
      subtotal: b.subtotal || 0,
      discountAmount: b.discountAmount || 0,
      afterDiscount: b.afterDiscount || 0,
      taxAmount: b.taxAmount || 0,
      grandTotal: b.grandTotal || 0,
      amountPaid: current?.payment?.amountPaid || 0,
      balance: current?.payment?.balance || 0,
      status: current?.payment?.status || 'Invoice',
    };
  };

  const startEditing = () => {
    if (current) {
      setEditForm({
        customer: { ...current.customer },
        items: [...(current.items || [])],
        discount: { type: current.billing?.discountType || 'Fixed', value: current.billing?.discountValue || 0, reason: current.billing?.discountAmount || 0 },
        payment: { method: current.payment?.method || 'Cash', amountPaid: current.payment?.amountPaid || 0 },
        notes: current.notes || '',
        jobCardLinked: current.jobCardLinked || '',
      });
      setEditing(true);
    }
  };

  const cancelEditing = () => setEditing(false);

  const setField = (key, value) => setEditForm((f) => ({ ...f, [key]: value }));
  const setFieldDeep = (path, value) => {
    const [section, field] = path.split('.');
    setEditForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  };

  const addItem = () => setEditForm((f) => ({ ...f, items: [...f.items, { productId: '', productCode: '', productName: '', quantity: 1, unitPrice: 0, tax: TAX_RATE }] }));
  const removeItem = (i) => setEditForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const setItem = (i, key, value) => {
    const items = [...editForm.items];
    items[i] = { ...items[i], [key]: value };
    setEditForm((f) => ({ ...f, items }));
  };

  const itemTotal = (item) => (item.quantity || 0) * (item.unitPrice || 0);
  const itemTaxAmount = (item) => (itemTotal(item) * (item.tax || 0)) / 100;

  const computeTotals = () => {
    const subtotal = (editForm?.items || []).reduce((s, item) => s + itemTotal(item), 0);
    const discountAmount = editForm?.discount?.type === 'Percentage'
      ? (subtotal * (editForm?.discount?.value || 0)) / 100
      : editForm?.discount?.value || 0;
    const afterDiscount = Math.max(subtotal - discountAmount, 0);
    const taxAmount = (afterDiscount * TAX_RATE) / 100;
    const grandTotal = afterDiscount + taxAmount;
    const amountPaid = Math.max((editForm?.payment?.amountPaid || 0), 0);
    const balance = Math.max(grandTotal - amountPaid, 0);
    let status = 'Invoice';
    if (amountPaid >= grandTotal) status = 'Paid';
    else if (amountPaid > 0) status = 'Pending';
    return { subtotal, discountAmount, afterDiscount, taxAmount, grandTotal, amountPaid, balance, status };
  };

  const editTotals = computeTotals();

  const handleSave = async () => {
    if (!editForm?.customer?.name?.trim()) {
      dispatch(showToast({ severity: 'error', message: 'Customer name is required' }));
      return;
    }
    if (!editForm?.customer?.phone || editForm.customer.phone.replace(/\D/g, '').length < 10) {
      dispatch(showToast({ severity: 'error', message: 'Valid customer phone is required' }));
      return;
    }
    if (!editForm?.items?.length || !editForm.items.some((i) => i.productId && i.productName)) {
      dispatch(showToast({ severity: 'error', message: 'At least one product must be added' }));
      return;
    }
    setLoadingAction(true);
    try {
      const payload = {
        customer: editForm.customer,
        items: editForm.items.map((i) => ({
          productId: i.productId,
          productCode: i.productCode,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          tax: i.tax,
        })),
        discount: { type: editForm.discount.type, value: editForm.discount.value, amount: editForm.discount.reason },
        payment: { method: editForm.payment.method, amountPaid: editForm.payment.amountPaid },
        notes: editForm.notes || '',
        jobCardLinked: editForm.jobCardLinked || null,
      };
      const res = await dispatch(updateSale({ id, payload }));
      if (updateSale.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Bill updated' }));
        setEditing(false);
        dispatch(fetchSale(id));
        dispatch(fetchPaymentHistory(id));
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to update' }));
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async () => {
    setLoadingAction(true);
    try {
      const res = await dispatch(deleteSale(id));
      if (deleteSale.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Bill deleted' }));
        navigate('/counter-sale');
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to delete' }));
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCancelBill = async () => {
    setLoadingAction(true);
    try {
      const res = await dispatch(updateSaleStatus({ id, status: 'Cancelled' }));
      if (updateSaleStatus.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Bill cancelled' }));
        setCancelConfirm(false);
        dispatch(fetchSale(id));
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to cancel' }));
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!recordingAmount || recordingAmount <= 0) {
      dispatch(showToast({ severity: 'error', message: 'Payment amount is required' }));
      return;
    }
    setLoadingAction(true);
    try {
      const res = await dispatch(recordPayment({ id, payload: { amount: recordingAmount, method: recordingMethod } }));
      if (recordPayment.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Payment recorded' }));
        setRecordingDialog(false);
        setRecordingAmount(0);
        dispatch(fetchSale(id));
        dispatch(fetchPaymentHistory(id));
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to record payment' }));
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const t = totals(current);
  const editable = t.status !== 'Paid' && t.status !== 'Cancelled';

  const handlePrintInvoice = () => {
    try {
      openInvoicePrint(invoiceFromSale(current));
    } catch (error) {
      dispatch(showToast({ severity: 'error', message: error instanceof Error ? error.message : 'Could not open the invoice' }));
    }
  };

  if (loading) return <Loader label="Loading bill..." />;
  if (!current) return <Typography color="error">Bill not found.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/counter-sale')} variant="outlined" sx={{ borderRadius: 2.5 }}>Back</Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" fontWeight={800}>{current.billNumber}</Typography>
          <StatusBadge status={t.status} />
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {editing ? (
          <>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} sx={{ borderRadius: 2.5 }}>Save Changes</Button>
            <Button variant="outlined" startIcon={<CancelIcon />} onClick={cancelEditing} sx={{ borderRadius: 2.5 }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="contained" startIcon={<EditIcon />} onClick={startEditing} disabled={!editable} sx={{ borderRadius: 2.5 }}>Edit</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrintInvoice} sx={{ borderRadius: 2.5 }}>Print Invoice / PDF</Button>
            {t.status === 'Invoice' && (
              <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteConfirm(true)} sx={{ borderRadius: 2.5 }}>Delete</Button>
            )}
            {t.status === 'Pending' && (
              <Button variant="outlined" color="warning" onClick={() => setCancelConfirm(true)} sx={{ borderRadius: 2.5 }}>Cancel Bill</Button>
            )}
            {t.balance > 0 && (
              <Button variant="contained" startIcon={<PaymentIcon />} onClick={() => setRecordingDialog(true)} sx={{ borderRadius: 2.5 }}>Record Payment</Button>
            )}
          </>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ p: 2, pb: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}><MTextField label="Bill Number" value={current.billNumber} disabled fullWidth sx={{ bgcolor: 'action.hover' }} /></Grid>
                  <Grid item xs={12} sm={6}><MTextField label="Bill Date" value={formatDateTime(current.billDate)} disabled fullWidth sx={{ bgcolor: 'action.hover' }} /></Grid>
                  <Grid item xs={12} sm={6}><MTextField label="Customer Name" value={current.customer?.name} onChange={(e) => setField('customer.name', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={6}><MTextField label="Phone" value={current.customer?.phone} onChange={(e) => setField('customer.phone', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12} sm={6}><MTextField label="Email" value={current.customer?.email} onChange={(e) => setField('customer.email', e.target.value)} fullWidth /></Grid>
                  <Grid item xs={12}><MTextField label="Address" value={current.customer?.address} onChange={(e) => setField('customer.address', e.target.value)} fullWidth multiline minRows={2} /></Grid>
                </Grid>
              </Box>
              <Divider />
              <Box sx={{ p: 2, pb: 2 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Bill Items</Typography>
                {(editForm?.items || current.items || []).map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <MTextField size="small" label="Product" value={item.productName || ''} onChange={(e) => setItem(i, 'productName', e.target.value)} sx={{ flex: 2, minWidth: 140 }} />
                    <MTextField size="small" label="Price" type="number" value={item.unitPrice || ''} onChange={(e) => setItem(i, 'unitPrice', +e.target.value)} sx={{ width: 90 }} />
                    <MTextField size="small" label="Qty" type="number" value={item.quantity || ''} onChange={(e) => setItem(i, 'quantity', +e.target.value)} sx={{ width: 70 }} />
                    <Typography sx={{ alignSelf: 'center', fontWeight: 600 }}>= {formatCurrency(itemTotal(item) + itemTaxAmount(item))}</Typography>
                    {editForm?.items?.length > 1 && (
                      <IconButton size="small" onClick={() => removeItem(i)}><CancelIcon fontSize="small" /></IconButton>
                    )}
                  </Box>
                ))}
                {editForm?.items?.length === 0 && !editing && (
                  <Typography variant="body2" color="text.secondary">No items</Typography>
                )}
                {editing && (
                  <Button size="small" variant="contained" onClick={addItem} sx={{ mt: 1 }}>+ Add Item</Button>
                )}
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <MTextField select label="Discount Type" value={editForm?.discount?.type || 'Fixed'} onChange={(e) => setFieldDeep('discount.type', e.target.value)} fullWidth sx={{ bgcolor: editing ? 'white' : 'action.hover' }}>
                      <MenuItem value="Fixed">Fixed</MenuItem>
                      <MenuItem value="Percentage">Percentage</MenuItem>
                    </MTextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <MTextField label="Discount Value" type="number" value={editForm?.discount?.value || 0} onChange={(e) => setFieldDeep('discount.value', +e.target.value)} fullWidth sx={{ bgcolor: editing ? 'white' : 'action.hover' }} />
                  </Grid>
                  <Grid item xs={12}>
                    <MTextField label="Notes" value={editForm?.notes || ''} onChange={(e) => setField('notes', e.target.value)} fullWidth multiline minRows={2} sx={{ bgcolor: editing ? 'white' : 'action.hover' }} />
                  </Grid>
                </Grid>
              </Box>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatCurrency(t.subtotal)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Discount</Typography>
                  <Typography variant="body1" fontWeight={600}>-{formatCurrency(t.discountAmount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">After Discount</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatCurrency(t.afterDiscount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Tax ({TAX_RATE}%)</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatCurrency(t.taxAmount)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight={700}>Grand Total</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatCurrency(t.grandTotal)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3, position: 'sticky', top: 80 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Payment Details</Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Amount Paid</Typography>
                  <Typography variant="body1" fontWeight={600}>{formatCurrency(t.amountPaid)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Balance Due</Typography>
                  <Typography variant="body1" fontWeight={600} color={t.balance > 0 ? 'warning.main' : 'success.main'}>
                    {formatCurrency(t.balance)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Payment Method</Typography>
                  <Typography variant="body1">{current.payment?.method || '—'}</Typography>
                </Box>
                {current.payment?.paidDate && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Paid On</Typography>
                    <Typography variant="body1">{formatDateTime(current.payment.paidDate)}</Typography>
                  </Box>
                )}
              </Box>
              {editing && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <MTextField select label="Payment Method" value={editForm?.payment?.method || 'Cash'} onChange={(e) => setFieldDeep('payment.method', e.target.value)} fullWidth sx={{ mb: 1 }}>
                    {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </MTextField>
                  <MTextField label="Amount Paid" type="number" value={editForm?.payment?.amountPaid || 0} onChange={(e) => setFieldDeep('payment.amountPaid', +e.target.value)} fullWidth />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Payment History</Typography>
              {paymentHistory?.length > 0 ? (
                (paymentHistory || []).map((p, i) => (
                  <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight={500}>{p.method} — {p.paidBy}</Typography>
                      <Typography variant="body1" fontWeight={600}>{formatCurrency(p.amount)}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">{formatDateTime(p.paidAt)}</Typography>
                    {p.notes && <Typography variant="caption" color="text.secondary">{p.notes}</Typography>}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">No payments recorded.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Bill</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Are you sure you want to delete this bill? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={loadingAction}>
            {loadingAction ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelConfirm} onClose={() => setCancelConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel Bill</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This will mark the bill as cancelled and restore stock for all items.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelConfirm(false)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={handleCancelBill} disabled={loadingAction}>
            {loadingAction ? 'Cancelling...' : 'Cancel Bill'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={recordingDialog} onClose={() => setRecordingDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Total / Paid / Balance</Typography>
            <Typography variant="body1">
              {formatCurrency(t.grandTotal)} / {formatCurrency(t.amountPaid)} / {formatCurrency(t.balance)}
            </Typography>
          </Box>
          <MTextField label="Payment Amount" type="number" value={recordingAmount || ''} onChange={(e) => setRecordingAmount(+e.target.value)} fullWidth sx={{ mb: 1 }} />
          <MTextField select label="Payment Method" value={recordingMethod} onChange={(e) => setRecordingMethod(e.target.value)} fullWidth>
            {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </MTextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecordingDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordPayment} disabled={loadingAction}>
            {loadingAction ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Status</DialogTitle>
        <DialogContent>
          <MTextField select label="New Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} fullWidth sx={{ mb: 1 }}>
            {SALE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </MTextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            if (!newStatus) return;
            setLoadingAction(true);
            try {
              const res = await dispatch(updateSaleStatus({ id, status: newStatus }));
              if (updateSaleStatus.fulfilled.match(res)) {
                dispatch(showToast({ severity: 'success', message: `Status updated to ${newStatus}` }));
                setStatusDialog(false);
                dispatch(fetchSale(id));
              } else {
                dispatch(showToast({ severity: 'error', message: res.error || 'Failed to update status' }));
              }
            } finally {
              setLoadingAction(false);
            }
          }}>Update</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
