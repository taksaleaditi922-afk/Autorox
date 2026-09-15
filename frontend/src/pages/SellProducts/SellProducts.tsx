import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, Table, TableHead, TableRow,
  TableBody, TableCell, TableContainer, TablePagination, IconButton, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, Grid, Divider, Menu, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  AddCircleOutline as AddCircleOutlineIcon,
} from '@mui/icons-material';
import { fetchSales, createSale, deleteSale, updateSaleStatus, recordPayment, fetchPaymentHistory } from '../../redux/salesSlice';
import { fetchProducts } from '../../redux/productsSlice';
import { showToast } from '../../redux/uiSlice';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';
import InvoicePreview from '../../components/InvoicePreview';
import Loader from '../../components/Loader';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/format';
import { SALE_STATUSES, SALE_STATUS_COLORS, PAYMENT_METHODS, TAX_RATE } from '../../constants';

const STATUS_OPTIONS = [...SALE_STATUSES];

const EMPTY_BILL = {
  customer: { name: '', email: '', phone: '', address: '' },
  items: [],
  discount: { type: 'Fixed', value: 0, reason: '' },
  payment: { method: 'Cash', amountPaid: 0 },
  notes: '',
  jobCardLinked: '',
};

const ITEM_ROWS = [{ productId: '', productCode: '', productName: '', quantity: 1, unitPrice: 0, tax: TAX_RATE }];

export default function SellProducts() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, pagination, loading } = useSelector((state) => state.sales);
  const { user } = useSelector((state) => state.auth);
  const [filters, setFilters] = useState({ status: '', q: '', advisor: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dialog, setDialog] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_BILL });
  const [billNumber, setBillNumber] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [pdfDialog, setPdfDialog] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentSale, setPaymentSale] = useState(null);
  const [availableCustomers, setAvailableCustomers] = useState([]);
  const [productSearch, setProductSearch] = useState('');

  const customerId = user?._id || null;
  const advisorName = user?.name || 'Advisor';

  useEffect(() => {
    dispatch(fetchSales({ ...filters, page: page + 1, limit: rowsPerPage }));
    dispatch(fetchProducts({ q: '', limit: 200 }));
    api.get('/customers', { params: { limit: 200 } }).then((res) => setAvailableCustomers(res.data.data || [])).catch(() => {});
  }, [dispatch, filters, page, rowsPerPage]);

  const handleFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const availableProducts = useSelector((state) => state.products.items || []);

  const resetBillForm = () => {
    setForm({ ...EMPTY_BILL });
    setStep(1);
    setBillNumber('');
  };

  const openNewBill = () => {
    setBillNumber(`BIL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`);
    setForm({ ...EMPTY_BILL, items: [...ITEM_ROWS] });
    setStep(1);
    setDialog(true);
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setFieldDeep = (path, value) => {
    const [section, field] = path.split('.');
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  };

  const handleCustomerSelect = (id) => {
    const customer = availableCustomers.find((item) => item._id === id);
    setForm((f) => ({
      ...f,
      customerId: id,
      customer: customer
        ? { customerId: id, name: customer.name || '', email: customer.email || '', phone: customer.phone || '', address: customer.address || '' }
        : { ...f.customer },
    }));
  };

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { productId: '', productCode: '', productName: '', quantity: 1, unitPrice: 0, tax: TAX_RATE }] }));

  const removeItem = (i) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const setItem = (i, key, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [key]: value };
    setForm((f) => ({ ...f, items }));
  };

  const filteredProducts = availableProducts.filter((product) => {
    const search = productSearch.trim().toLowerCase();
    return !search || `${product.productName} ${product.productCode}`.toLowerCase().includes(search);
  });

  const addProductToBill = (product) => {
    const existingIndex = form.items.findIndex((item) => item.productId === product._id);
    if (existingIndex >= 0) {
      setForm((f) => ({
        ...f,
        items: f.items.map((item, index) => index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item),
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      items: [...f.items.filter((item) => item.productId), {
        productId: product._id,
        productCode: product.productCode,
        productName: product.productName,
        quantity: 1,
        unitPrice: product.pricing?.sellingPrice || 0,
        tax: product.pricing?.tax ?? TAX_RATE,
      }],
    }));
  };

  const itemTotal = (item) => (item.quantity || 0) * (item.unitPrice || 0);
  const itemTaxAmount = (item) => (itemTotal(item) * (item.tax || 0)) / 100;

  const computeTotals = () => {
    const subtotal = (form.items || []).reduce((s, item) => s + itemTotal(item), 0);
    const discountAmount = form.discount?.type === 'Percentage'
      ? (subtotal * (form.discount?.value || 0)) / 100
      : form.discount?.value || 0;
    const afterDiscount = Math.max(subtotal - discountAmount, 0);
    const taxAmount = (afterDiscount * TAX_RATE) / 100;
    const grandTotal = afterDiscount + taxAmount;
    const amountPaid = Math.max(form.payment?.amountPaid || 0, 0);
    const balance = Math.max(grandTotal - amountPaid, 0);
    let status = 'Invoice';
    if (amountPaid >= grandTotal) status = 'Paid';
    else if (amountPaid > 0) status = 'Pending';
    return { subtotal, discountAmount, afterDiscount, taxAmount, grandTotal, amountPaid, balance, status };
  };

  const totals = computeTotals();

  const handleSale = async (saveAsDraft = false) => {
    if (!form.customer?.name?.trim()) {
      dispatch(showToast({ severity: 'error', message: 'Customer name is required' }));
      return;
    }
    if (!form.customer?.phone || form.customer.phone.replace(/\D/g, '').length < 10) {
      dispatch(showToast({ severity: 'error', message: 'Valid customer phone is required' }));
      return;
    }
    if (!form.items.length || !form.items.some((i) => i.productId && i.productName)) {
      dispatch(showToast({ severity: 'error', message: 'At least one product must be added' }));
      return;
    }
    setLoadingDelete(true);
    try {
      const payload = {
        billNumber: billNumber || undefined,
        customer: { ...form.customer },
        items: form.items.map((i) => ({
          productId: i.productId,
          productCode: i.productCode,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          tax: i.tax,
        })),
        discount: { type: form.discount.type, value: form.discount.value, reason: form.discount.reason },
        tax: { rate: TAX_RATE },
        payment: { method: form.payment.method, amountPaid: form.payment.amountPaid },
        notes: form.notes || '',
        jobCardLinked: form.jobCardLinked || null,
      };
      const res = await dispatch(createSale(payload));
      if (createSale.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Bill created successfully' }));
        setDialog(false);
        resetBillForm();
        dispatch(fetchSales({ page: 1, limit: rowsPerPage, ...filters }));
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to create bill' }));
      }
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setLoadingDelete(true);
    try {
      const res = await dispatch(deleteSale(confirmDelete));
      if (deleteSale.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Bill deleted' }));
        setConfirmDelete(null);
        setPage(0);
        dispatch(fetchSales({ page: 1, limit: rowsPerPage, ...filters }));
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to delete' }));
      }
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleCancel = async () => {
    const res = await dispatch(updateSaleStatus({ id: confirmDelete, status: 'Cancelled' }));
    if (updateSaleStatus.fulfilled.match(res)) {
      dispatch(showToast({ severity: 'success', message: 'Bill cancelled' }));
      setConfirmDelete(null);
      setPage(0);
      dispatch(fetchSales({ page: 1, limit: rowsPerPage, ...filters }));
    } else {
      dispatch(showToast({ severity: 'error', message: res.error || 'Failed to cancel' }));
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentSale) return;
    const { id, amount, method } = paymentSale;
    if (!amount || amount <= 0) {
      dispatch(showToast({ severity: 'error', message: 'Payment amount is required' }));
      return;
    }
    setLoadingRecord(true);
    try {
      const res = await dispatch(recordPayment({ id, payload: { amount, method } }));
      if (recordPayment.fulfilled.match(res)) {
        dispatch(showToast({ severity: 'success', message: 'Payment recorded' }));
        setPaymentDialog(false);
        setPaymentSale(null);
        dispatch(fetchSales({ page: 1, limit: rowsPerPage, ...filters }));
      } else {
        dispatch(showToast({ severity: 'error', message: res.error || 'Failed to record payment' }));
      }
    } finally {
      setLoadingRecord(false);
    }
  };

  const openPdf = (sale) => {
    setPdfData(sale);
    setPdfDialog(true);
  };

  const rows = items.map((s, i) => ({
    ...s,
    key: s._id,
    status: s.payment?.status || 'Invoice',
    amountPaid: s.payment?.amountPaid || 0,
    balance: s.payment?.balance || 0,
    grandTotal: s.billing?.grandTotal || 0,
    customerName: s.customer?.name || '—',
    phone: s.customer?.phone || '—',
    advisorName: s.advisor?.name || advisorName,
    billDate: s.billDate ? formatDate(s.billDate) : '—',
  }));

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisYear = new Date(today.getFullYear(), 0, 1);

    let todaySales = 0, monthSales = 0, yearSales = 0, todayBills = 0;
    let totalRevenue = 0, totalPaid = 0, totalOutstanding = 0;

    for (const s of items) {
      const d = new Date(s.billDate || 0);
      if (d >= today) todaySales += (s.billing?.grandTotal || 0);
      if (d >= thisMonth) monthSales += (s.billing?.grandTotal || 0);
      if (d >= thisYear) yearSales += (s.billing?.grandTotal || 0);
      if (d >= today) todayBills += 1;
      totalRevenue += (s.billing?.grandTotal || 0);
      totalPaid += (s.payment?.amountPaid || 0);
      totalOutstanding += (s.payment?.balance || 0);
    }

    return {
      todaySales: formatCurrency(todaySales),
      monthSales: formatCurrency(monthSales),
      yearSales: formatCurrency(yearSales),
      todayBills,
      totalRevenue: formatCurrency(totalRevenue),
      totalPaid: formatCurrency(totalPaid),
      totalOutstanding: formatCurrency(totalOutstanding),
    };
  }, [items]);

  const contextMenuAction = (e, sale) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, id: sale._id, amount: (sale.payment?.balance || 0), method: sale.payment?.method || 'Cash', sale });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Sell Products</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Create bills and track product sales</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={openNewBill}>
          New Bill
        </Button>
      </Box>

      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Total Sales (Today)</Typography>
              <Typography variant="h4" fontWeight={800}>{kpis.todaySales}</Typography>
              <Chip label={`${kpis.todayBills} bills`} size="small" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Total Sales (This Month)</Typography>
              <Typography variant="h4" fontWeight={800}>{kpis.monthSales}</Typography>
              <Typography variant="caption" color="text.muted">Monthly revenue</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Total Revenue</Typography>
              <Typography variant="h4" fontWeight={800}>{kpis.totalRevenue}</Typography>
              <Typography variant="caption" color="text.muted">All-time</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Paid</Typography>
              <Typography variant="h4" fontWeight={800} color="success.main">{kpis.totalPaid}</Typography>
              <Typography variant="caption" color="text.muted" sx={{ mt: 1 }}>Outstanding: {kpis.totalOutstanding}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            size="small" label="Search" value={filters.q} onChange={(e) => handleFilter('q', e.target.value)}
            placeholder="Bill #, customer, phone" sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
          />
          <TextField select size="small" label="Status" value={filters.status}
            onChange={(e) => handleFilter('status', e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <Button startIcon={<RefreshIcon />} onClick={() => dispatch(fetchSales({ page: 1, limit: rowsPerPage, ...filters }))}>
            Refresh
          </Button>
        </Box>
      </Card>

      <Card>
        {loading ? (
          <Loader label="Loading sales..." />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bill No.</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Advisor</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key} hover onContextMenu={(e) => contextMenuAction(e, row)}>
                      <TableCell>{row.billNumber}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.customerName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.phone}</Typography>
                      </TableCell>
                      <TableCell>{row.advisorName}</TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.billDate}</TableCell>
                      <TableCell align="right">{formatCurrency(row.grandTotal)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.amountPaid)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.balance)}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => navigate(`/sell/${row.key}`)} title="View">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => openPdf(row)} title="Print / PDF">
                          <PrintIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => navigate(`/sell/${row.key}/edit`)} title="Edit" disabled={row.status === 'Paid' || row.status === 'Cancelled'}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setConfirmDelete(row.key)} title="Delete" disabled={row.status === 'Paid' || row.status === 'Cancelled'}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                        <Typography variant="body2" color="text.secondary">No sales found.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div" count={pagination.total} page={page} onPageChange={(e, p) => setPage(p)}
              rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </>
        )}
      </Card>

      <Menu
        open={!!contextMenu} onClose={() => setContextMenu(null)}
        anchorEl={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      >
        <MenuItem onClick={() => { setPaymentSale(contextMenu); setPaymentDialog(true); setContextMenu(null); }}>
          <ListItemIcon><PaymentIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Record Payment" secondary={`Balance: ${formatCurrency(contextMenu?.amount || 0)}`} />
        </MenuItem>
        <MenuItem onClick={() => { setPdfData(contextMenu?.sale); setPdfDialog(true); setContextMenu(null); }}>
          <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Print / PDF" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => navigate(`/sell/${contextMenu?.id}`)}>
          <ListItemIcon><ReceiptIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="View Details" />
        </MenuItem>
      </Menu>

      <Dialog open={dialog} onClose={() => setDialog(false)} fullWidth maxWidth="md">
        {step === 1 && (
          <>
            <DialogTitle>Create Bill — Step 1: Select Customer</DialogTitle>
            <DialogContent dividers>
              <TextField select fullWidth label="Customer" value={form.customerId || ''}
                onChange={(e) => setField('customerId', e.target.value)} margin="normal">
                {availableCustomers?.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
              </TextField>
              <Typography variant="subtitle1" fontWeight={600} mt={2}>Or enter customer details</Typography>
              <TextField fullWidth label="Name" value={form.customer.name} onChange={(e) => setFieldDeep('customer.name', e.target.value)} margin="normal" />
              <TextField fullWidth label="Email" value={form.customer.email} onChange={(e) => setFieldDeep('customer.email', e.target.value)} margin="normal" />
              <TextField fullWidth label="Phone" value={form.customer.phone} onChange={(e) => setFieldDeep('customer.phone', e.target.value)} margin="normal" />
              <TextField fullWidth label="Address" value={form.customer.address} onChange={(e) => setFieldDeep('customer.address', e.target.value)} margin="normal" multiline minRows={2} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={() => setStep(2)}>Continue</Button>
            </DialogActions>
          </>
        )}

        {step === 2 && (
          <>
            <DialogTitle>Create Bill — Step 2: Add Products</DialogTitle>
            <DialogContent dividers>
              <TextField fullWidth size="small" label="Search Products" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} margin="normal"
                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Available Products</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Stock</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProducts.map((p) => (
                        <TableRow key={p._id} hover>
                          <TableCell>{p.productName}</TableCell>
                          <TableCell align="right">{formatCurrency(p.pricing?.sellingPrice || 0)}</TableCell>
                          <TableCell>{p.inventory?.quantity ?? 0} {p.inventory?.unit || ''}</TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" onClick={() => addProductToBill(p)}>Add</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredProducts.length === 0 && (
                        <TableRow><TableCell colSpan={4} align="center">No products found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>Bill Items</Typography>
                <Button size="small" variant="contained" onClick={addItem}>+ Add Item</Button>
              </Box>
              {(form.items || []).map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField size="small" label="Product" value={item.productName || ''} onChange={(e) => setItem(i, 'productName', e.target.value)} sx={{ flex: 2, minWidth: 140 }} />
                  <TextField size="small" label="Price" type="number" value={item.unitPrice || ''} onChange={(e) => setItem(i, 'unitPrice', +e.target.value)} sx={{ width: 90 }} />
                  <TextField size="small" label="Qty" type="number" value={item.quantity || ''} onChange={(e) => setItem(i, 'quantity', +e.target.value)} sx={{ width: 70 }} />
                  <Typography sx={{ alignSelf: 'center', fontWeight: 600 }}>= {formatCurrency(itemTotal(item))}</Typography>
                  {form.items.length > 1 && (
                    <IconButton size="small" onClick={() => removeItem(i)}><CloseIcon fontSize="small" /></IconButton>
                  )}
                </Box>
              ))}
              {form.items.length === 0 && (
                <Typography variant="body2" color="text.secondary">No items added.</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStep(1)}>Back</Button>
              <Button variant="contained" onClick={() => setStep(3)}>Continue</Button>
            </DialogActions>
          </>
        )}

        {step === 3 && (
          <>
            <DialogTitle>Create Bill — Step 3: Review & Confirm</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Bill No.</Typography>
                <Typography variant="h6">{billNumber}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Bill Date</Typography>
                <Typography variant="body1">{new Date().toLocaleDateString()}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Customer</Typography>
                <Typography variant="body1" fontWeight={600}>{form.customer.name}</Typography>
                {form.customer.phone && <Typography variant="body2" color="text.secondary">{form.customer.phone}</Typography>}
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Advisor</Typography>
                <Typography variant="body1">{advisorName}</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Items</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Qty</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Tax</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(form.items || []).map((item, i) => (
                        <TableRow key={i} hover>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell align="right">{formatCurrency(itemTaxAmount(item))}</TableCell>
                          <TableCell align="right">{formatCurrency(itemTotal(item) + itemTaxAmount(item))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
              <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Subtotal</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatCurrency(totals.subtotal)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Discount ({form.discount.type} {form.discount.value}%)</Typography>
                  <Typography variant="body2" fontWeight={600}>-{formatCurrency(totals.discountAmount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">After Discount</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatCurrency(totals.afterDiscount)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Tax ({TAX_RATE}%)</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatCurrency(totals.taxAmount)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight={700}>Grand Total</Typography>
                  <Typography variant="h6" fontWeight={700}>{formatCurrency(totals.grandTotal)}</Typography>
                </Box>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Payment</Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                  <TextField select size="small" label="Payment Method" value={form.payment.method}
                    onChange={(e) => setFieldDeep('payment.method', e.target.value)} sx={{ flex: 1 }}>
                    {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Amount Paid" type="number" value={form.payment.amountPaid}
                    onChange={(e) => setFieldDeep('payment.amountPaid', +e.target.value)} sx={{ width: 120 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Balance Due</Typography>
                  <Typography variant="body1" fontWeight={600} color={totals.balance > 0 ? 'warning.main' : 'success.main'}>
                    {formatCurrency(totals.balance)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Status</Typography>
                  <Typography variant="body1" fontWeight={600}>{totals.status}</Typography>
                </Box>
              </Box>
              <TextField fullWidth label="Notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} margin="normal" multiline minRows={2} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setStep(2)}>Back</Button>
              <Button variant="outlined" onClick={() => { setDialog(false); resetBillForm(); }}>Cancel</Button>
              <Button variant="contained" onClick={() => handleSale(false)}>Generate Invoice</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Bill</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Are you sure you want to delete this bill? Only pending or invoice bills can be deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={loadingDelete}>
            {loadingDelete ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pdfDialog} onClose={() => setPdfDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Print / Invoice</DialogTitle>
        <DialogContent dividers>
          {pdfData ? (
            <InvoicePreview sale={pdfData} onPrint={() => window.print()} />
          ) : (
            <Typography color="text.secondary">No bill selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPdfDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => pdfData && window.print()}>
            Print
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentDialog && !!paymentSale} onClose={() => { setPaymentDialog(false); setPaymentSale(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {paymentSale ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Bill</Typography>
                <Typography variant="body1" fontWeight={600}>{paymentSale.sale?.billNumber}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Total Amount / Paid / Balance</Typography>
                <Typography variant="body1">
                  {formatCurrency(paymentSale.sale?.billing?.grandTotal || 0)} /{' '}
                  {formatCurrency(paymentSale.sale?.payment?.amountPaid || 0)} /{' '}
                  {formatCurrency(paymentSale.amount)}
                </Typography>
              </Box>
              <TextField size="small" label="Payment Amount" type="number" value={paymentSale.amount || ''}
                onChange={(e) => setPaymentSale((m) => (m ? { ...m, amount: +e.target.value } : null))}
                sx={{ width: 140, mb: 1 }} />
              <TextField select size="small" label="Payment Method" value={paymentSale.method}
                onChange={(e) => setPaymentSale((m) => (m ? { ...m, method: e.target.value } : null))} sx={{ width: 140 }}>
                {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </>
          ) : (
            <Typography color="text.secondary">No bill selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPaymentDialog(false); setPaymentSale(null); }}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordPayment} disabled={loadingRecord}>
            {loadingRecord ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
