import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { Add, DeleteOutline, InboxOutlined, Search } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { showToast } from '../../redux/uiSlice';
import { ordersApi, orderErrorMessage, type PartOrder } from '../../services/partOrdersService';
import { purchaseInvoiceForPrint, money } from '../../services/purchaseInvoiceService';
import { buildInvoiceHtml, openInvoicePrint } from '../../services/invoicePrintService';
import useDebounce from '../../utils/useDebounce';
import { formatDate } from '../../utils/format';
export function vehicleType(order: PartOrder) {
  const types = [...new Set(order.items.map(line => line.vehicleType).filter(Boolean))];
  return types.length > 1 ? 'Mixed' : types[0] || '—';
}
export default function BulkOrdersTab() {
  const navigate = useNavigate(), dispatch = useAppDispatch(), theme = useTheme();
  const user = useAppSelector(state => state.auth.user), canEdit = ['Admin', 'Service Manager'].includes(user?.role || '');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''), q = useDebounce(search), [status, setStatus] = useState('All');
  const [page, setPage] = useState(0), [limit, setLimit] = useState(10), [total, setTotal] = useState(0);
  const [orders, setOrders] = useState<PartOrder[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const [view, setView] = useState<PartOrder | null>(null), [confirm, setConfirm] = useState<{ order: PartOrder; action: 'receive' | 'delete' } | null>(null), [busy, setBusy] = useState(false);
  const invoiceId = params.get('invoice');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    ordersApi.list({ bulk: true, q, status, page: page + 1, limit }, controller.signal).then(result => { if (!controller.signal.aborted) { setOrders(result.data); setTotal(result.pagination.total); } }).catch(e => { if (!controller.signal.aborted) setError(orderErrorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [q, status, page, limit, version]);
  useEffect(() => {
    if (!invoiceId) return;
    const controller = new AbortController();
    ordersApi.get(invoiceId, controller.signal).then(order => { if (!controller.signal.aborted) setView(order); }).catch(e => { if (!controller.signal.aborted) setError(orderErrorMessage(e)); });
    return () => controller.abort();
  }, [invoiceId]);
  const closeView = () => { setView(null); if (invoiceId) setParams(p => { p.delete('invoice'); return p; }, { replace: true }); };
  const runAction = async () => {
    if (!confirm) return; setBusy(true);
    try {
      if (confirm.action === 'receive') await ordersApi.action(confirm.order.id, 'receive'); else await ordersApi.deleteBulk(confirm.order.id);
      dispatch(showToast({ severity: 'success', message: confirm.action === 'receive' ? 'Order received. Inventory and stock history updated.' : 'Order deleted.' }));
      setConfirm(null); setPage(0); setVersion(v => v + 1);
    } catch (e) { dispatch(showToast({ severity: 'error', message: orderErrorMessage(e) })); } finally { setBusy(false); }
  };
  return <Box role="tabpanel" id="orders-panel" aria-labelledby="tab-bulk" sx={{ minHeight: 420 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={1} sx={{ mt: 2, mb: 1 }}>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>Part Details</Typography>
      <TextField size="small" placeholder="Search by order ID, vendor..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} inputProps={{ 'aria-label': 'Search bulk orders' }} InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} sx={{ width: { xs: '100%', md: 250 } }} />
      <TextField select size="small" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} inputProps={{ 'aria-label': 'Bulk order status' }} sx={{ minWidth: 105 }}>{['All', 'Pending', 'Received'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
      {canEdit && <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/part-orders/bulk/new')}>Add New</Button>}
    </Stack>
    {error ? <Alert severity="error" action={<Button onClick={() => setVersion(v => v + 1)}>Retry</Button>}>{error}</Alert> : <>
      <TableContainer sx={{ overflowX: 'auto', maxHeight: 510 }}><Table stickyHeader size="small" aria-label="Bulk orders" sx={{ minWidth: 900, '& th': { bgcolor: 'background.subtle', py: 1.2 }, '& td': { borderColor: 'divider', py: 1.4 } }}>
        <TableHead><TableRow>{['Order ID', 'Vendor Details', 'Vehicle Type', 'Date', 'Est. Delivery', 'Status', 'Actions'].map(title => <TableCell key={title}>{title}</TableCell>)}</TableRow></TableHead>
        <TableBody>{loading ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}>{Array.from({ length: 7 }, (_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>) : !orders.length ? <TableRow><TableCell colSpan={7}><Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: 180, color: 'text.muted' }}><InboxOutlined sx={{ fontSize: 44 }} /><Typography>No data</Typography></Stack></TableCell></TableRow> : orders.map(order => <TableRow key={order.id} hover>
          <TableCell>{order.orderNumber}</TableCell><TableCell><Tooltip title={order.vendorName || 'No vendor selected'}><Typography noWrap sx={{ maxWidth: 160 }}>{order.vendorName || '—'}</Typography></Tooltip>{order.vendorPhone && <Typography variant="caption" color="text.secondary">{order.vendorPhone}</Typography>}</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>{vehicleType(order)}</TableCell><TableCell>{formatDate(order.orderDate)}<Typography variant="caption" color="text.secondary" display="block">{order.isDraft ? 'Draft' : order.status === 'Received' ? 'Order Received' : order.status === 'Cancelled' ? 'Order Cancelled' : 'Order Placed'}</Typography></TableCell>
          <TableCell>{formatDate(order.expectedDelivery)}</TableCell><TableCell><Chip size="small" variant="outlined" color={order.status === 'Received' ? 'success' : order.status === 'Pending' ? 'warning' : 'default'} label={order.status} /></TableCell>
          <TableCell><Stack direction="row" spacing={0.5} alignItems="center"><Button size="small" variant="contained" onClick={() => setView(order)}>View</Button>{canEdit && <>
            <Tooltip title={order.isDraft ? 'Finalize the draft before receiving' : 'Receive order'}><span><Button size="small" variant="outlined" disabled={order.status !== 'Pending' || order.isDraft} onClick={() => setConfirm({ order, action: 'receive' })}>Update</Button></span></Tooltip>
            <Button size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} disabled={order.status !== 'Pending'} onClick={() => navigate(`/part-orders/bulk/${order.id}/edit`)}>Edit</Button>
            <Tooltip title="Delete order"><span><IconButton aria-label={`Delete ${order.orderNumber}`} size="small" color="error" disabled={order.status !== 'Pending'} onClick={() => setConfirm({ order, action: 'delete' })}><DeleteOutline fontSize="small" /></IconButton></span></Tooltip>
          </>}</Stack></TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer>
      <TablePagination component="div" count={total} page={page} rowsPerPage={limit} rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={e => { setLimit(Number(e.target.value)); setPage(0); }} />
    </>}
    <Dialog open={!!view} onClose={closeView} maxWidth="lg" fullWidth><DialogTitle>{view?.invoice ? `Purchase Invoice ${view.invoice.invoiceNumber}` : `Order ${view?.orderNumber}`}</DialogTitle><DialogContent>
      {view?.invoice ? <iframe title="Purchase invoice preview" sandbox="allow-scripts allow-modals allow-same-origin" srcDoc={buildInvoiceHtml(purchaseInvoiceForPrint(view.invoice, theme.palette.primary.main, view))} style={{ width: '100%', height: '65vh', border: 0 }} /> : <Stack spacing={1}><Typography>Vendor: {view?.vendorName || 'Not selected'}</Typography><Typography>{view?.isDraft ? 'Draft' : view?.status}</Typography><Typography>Ordered: {formatDate(view?.orderDate)} · Expected: {formatDate(view?.expectedDelivery)}</Typography>{view?.items.map(line => <Typography key={line.productId}>{line.partName} ({line.partNumber}) · {line.quantity} × {money(line.unitPrice)}</Typography>)}<Typography fontWeight={700}>Total: {money(view?.totalAmount || 0)}</Typography></Stack>}
    </DialogContent><DialogActions>{view?.invoice && <Button onClick={() => { try { openInvoicePrint(purchaseInvoiceForPrint(view.invoice!, theme.palette.primary.main, view)); } catch (e) { dispatch(showToast({ severity: 'error', message: orderErrorMessage(e) })); } }}>Print / Save as PDF</Button>}<Button onClick={closeView}>Close</Button></DialogActions></Dialog>
    <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)}><DialogTitle>{confirm?.action === 'delete' ? 'Delete bulk order?' : 'Receive bulk order?'}</DialogTitle><DialogContent>{confirm?.action === 'delete' ? 'This order will be removed from the list.' : 'All line quantities will be added to Inventory and logged with your employee account.'}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setConfirm(null)}>Back</Button><Button disabled={busy} variant="contained" color={confirm?.action === 'delete' ? 'error' : 'primary'} onClick={runAction}>{busy ? 'Working…' : 'Confirm'}</Button></DialogActions></Dialog>
  </Box>;
}
