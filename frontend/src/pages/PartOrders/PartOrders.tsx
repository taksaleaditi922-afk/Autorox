import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, InputAdornment, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Close, EditOutlined, InboxOutlined, Inventory2Outlined, LocalAtmOutlined, SouthOutlined, CurrencyRupee, Search, VisibilityOutlined, CheckCircleOutline, CancelOutlined } from '@mui/icons-material';
import { useAppSelector } from '../../store/hooks';
import InventoryPageHeader from '../Inventory/InventoryPageHeader';
import PartFormDialog from '../Inventory/PartFormDialog';
import BulkOrdersTab from './BulkOrdersTab';
import { ordersApi, type PartOrder, type OrderSummary } from '../../services/partOrdersService';
import api from '../../services/api';
import useDebounce from '../../utils/useDebounce';
import { formatCurrency, formatDate } from '../../utils/format';
const errorMessage = (error: any) => error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unable to load orders. Please try again.';
const columns = [['Order ID', 'orderNumber'], ['Vendor Details', 'vendorName'], ['Part Name', 'items.partName'], ['Part Number', 'items.partNumber'], ['Vehicle Type', ''], ['Qty', ''], ['Part Type', ''], ['Customer Name', 'customerName'], ['Date', 'orderDate'], ['Est. Delivery', 'expectedDelivery'], ['Status', 'status'], ['Actions', '']];
const blank = () => ({ vendorName: '', vendorPhone: '', customerName: '', expectedDelivery: '', notes: '', quantity: '1', unitPrice: '0' });
export default function PartOrders() {
  const user = useAppSelector(state => state.auth.user);
  const canEdit = ['Admin', 'Service Manager'].includes(user?.role || '');
  const { toggleDrawer } = useOutletContext<{ toggleDrawer: () => void }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = ['bulk', 'suggestions'].includes(params.get('tab') || '') ? params.get('tab')! : 'orders';
  const [search, setSearch] = useState(''), [status, setStatus] = useState('All');
  const q = useDebounce(search);
  const [page, setPage] = useState(0), [limit, setLimit] = useState(10), [sort, setSort] = useState('orderDate'), [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [orders, setOrders] = useState<PartOrder[]>([]), [suggestions, setSuggestions] = useState<any[]>([]), [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<OrderSummary | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [summaryError, setSummaryError] = useState(''), [version, setVersion] = useState(0);
  const [drawer, setDrawer] = useState(false), [editing, setEditing] = useState<PartOrder | null>(null), [form, setForm] = useState(blank()), [part, setPart] = useState<any>(null);
  const [partQuery, setPartQuery] = useState(''), [options, setOptions] = useState<any[]>([]), [partError, setPartError] = useState('');
  const partSearch = useDebounce(partQuery);
  const [busy, setBusy] = useState(false), [formError, setFormError] = useState(''), [notice, setNotice] = useState('');
  const [view, setView] = useState<PartOrder | null>(null), [confirm, setConfirm] = useState<{ order: PartOrder; action: 'receive' | 'cancel' } | null>(null);
  const [newPartOpen, setNewPartOpen] = useState(false), [newPartError, setNewPartError] = useState('');
  useEffect(() => {
    if (tab === 'bulk') return;
    const controller = new AbortController(); setLoading(true); setError('');
    const request = tab === 'suggestions' ? ordersApi.suggestions({ q, page: page + 1, limit }, controller.signal) : ordersApi.list({ q, status, page: page + 1, limit, sort, direction, bulk: tab === 'bulk' }, controller.signal);
    request.then(result => { if (!controller.signal.aborted) { if (tab === 'suggestions') setSuggestions(result.data); else setOrders(result.data); setTotal(result.pagination.total); } }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, q, status, page, limit, sort, direction, version]);
  useEffect(() => {
    const controller = new AbortController(); setSummaryError('');
    ordersApi.summary(controller.signal).then(setSummary).catch(e => { if (!controller.signal.aborted) setSummaryError(errorMessage(e)); });
    return () => controller.abort();
  }, [version]);
  useEffect(() => {
    if (!drawer) return;
    const controller = new AbortController(); setPartError('');
    api.get('/products', { params: { q: partSearch, limit: 30 }, signal: controller.signal }).then(r => setOptions(r.data.data)).catch(e => { if (!controller.signal.aborted) setPartError(errorMessage(e)); });
    return () => controller.abort();
  }, [drawer, partSearch]);
  const refresh = () => setVersion(v => v + 1);
  const openCreate = (product?: any) => { setEditing(null); setForm({ ...blank(), ...(product ? { vendorName: product.supplier?.supplierName || '', vendorPhone: product.supplier?.supplierPhone || '', quantity: String(product.suggestedQuantity), unitPrice: String(product.pricing?.costPrice || 0) } : {}) }); setPart(product || null); setPartQuery(''); setFormError(''); setDrawer(true); };
  const openEdit = (order: PartOrder) => { if (order.bulk) { navigate(`/part-orders/bulk/${order.id}/edit`); return; } setEditing(order); const item = order.items[0]; setPart({ id: item.productId, productName: item.partName, productCode: item.partNumber }); setForm({ vendorName: order.vendorName, vendorPhone: order.vendorPhone || '', customerName: order.customerName || '', notes: order.notes || '', expectedDelivery: order.expectedDelivery?.slice(0, 10) || '', quantity: String(item.quantity), unitPrice: String(item.unitPrice) }); setFormError(''); setDrawer(true); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); setFormError(''); if (!part) { setFormError('Choose an Inventory part.'); return; } setBusy(true); try { await ordersApi.save({ ...form, bulk: tab === 'bulk', items: [{ productId: part.id, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }] }, editing?.id); setDrawer(false); setNotice(editing ? 'Order updated.' : 'Order created.'); refresh(); } catch (e) { setFormError(errorMessage(e)); } finally { setBusy(false); } };
  const runAction = async () => { if (!confirm) return; setBusy(true); try { await ordersApi.action(confirm.order.id, confirm.action); setNotice(confirm.action === 'receive' ? 'Order received and Inventory stock updated.' : 'Order cancelled.'); setConfirm(null); refresh(); } catch (e) { setNotice(''); setError(errorMessage(e)); setConfirm(null); } finally { setBusy(false); } };
  const actionButton = (title: string, icon: React.ReactNode, onClick: () => void) => <Tooltip title={title}><IconButton size="small" aria-label={title} onClick={onClick}>{icon}</IconButton></Tooltip>;
  return <>
    <InventoryPageHeader title="Part Orders" avatarLabel={(user?.name || user?.email || 'A').charAt(0).toUpperCase()} onMenuClick={toggleDrawer} />
    <Card sx={{ p: { xs: 1.5, sm: 2 }, minHeight: 475 }}>
      <Stack role="tablist" aria-label="Order views" direction="row" justifyContent="center" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        {[['orders', 'Part Orders'], ['bulk', 'Bulk Orders'], ['suggestions', 'Suggestions']].map(([key, label], index) => <Button key={key} role="tab" id={`tab-${key}`} aria-controls="orders-panel" aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} variant={tab === key ? 'contained' : 'outlined'} sx={{ minWidth: { xs: 100, sm: 145 } }} onClick={() => { setParams(p => { p.set('tab', key); return p; }); setPage(0); }} onKeyDown={event => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const keys = ['orders', 'bulk', 'suggestions']; const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3; setParams(p => { p.set('tab', keys[next]); return p; }); setPage(0); document.getElementById(`tab-${keys[next]}`)?.focus(); } }}>{label}</Button>)}
      </Stack>
      {tab === 'bulk' ? <BulkOrdersTab /> : <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2.5 }}>
        {([['Total Orders', summary?.total, Inventory2Outlined, 'info'], ['Pending Orders', summary?.pending, LocalAtmOutlined, 'error'], ['Completed Orders', summary?.completed, SouthOutlined, 'success'], ['Total Order Value', summary ? formatCurrency(summary.value) : undefined, CurrencyRupee, 'primary']] as const).map(([label, value, Icon, color]) => <Card variant="outlined" key={label} sx={{ px: 2, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'none' }}><Box><Typography fontWeight={800} color="primary.main" sx={{ fontSize: '1.35rem' }}>{value ?? (summaryError ? '—' : <Skeleton width={70} />)}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box><Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: color === 'primary' ? 'background.subtle' : `${color}.light`, color: `${color}.main` }}><Icon fontSize="small" /></Box></Card>)}
      </Box>
      {summaryError && <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>} sx={{ mb: 2 }}>Summary unavailable: {summaryError}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      <Box role="tabpanel" id="orders-panel" aria-labelledby={`tab-${tab}`}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>{tab === 'suggestions' ? 'Reorder Suggestions' : 'Part Details'}</Typography>
        {tab !== 'suggestions' && <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>{['Received', 'Pending'].map(s => <Stack direction="row" spacing={0.5} alignItems="center" key={s}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s === 'Received' ? 'success.main' : 'error.main' }} /><Typography variant="caption" color="text.secondary">{s}</Typography></Stack>)}</Stack>}
        <TextField size="small" placeholder="Search by part name, customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} inputProps={{ 'aria-label': 'Search orders or parts' }} InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} sx={{ width: { xs: '100%', md: 250 } }} />
        {tab !== 'suggestions' && <TextField select size="small" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} inputProps={{ 'aria-label': 'Order status' }} sx={{ minWidth: 105 }}>{['All', 'Pending', 'Received'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>}
        {canEdit && tab !== 'suggestions' && <Button startIcon={<Add />} variant="contained" onClick={() => openCreate()}>Create Order</Button>}
      </Stack>
      {tab === 'suggestions' && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Parts below minimum stock. Suggested quantities replenish to the minimum level.</Typography>}
      {error ? <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>}>{error}</Alert> : <>
      <TableContainer sx={{ maxHeight: 520, overflowX: 'auto' }}>
        <Table stickyHeader size="small" aria-label={tab === 'suggestions' ? 'Reorder suggestions' : 'Part orders'} sx={{ minWidth: tab === 'suggestions' ? 650 : 1250, '& th': { bgcolor: 'background.subtle', whiteSpace: 'nowrap', py: 1.3 }, '& td': { py: 1.5, borderColor: 'divider' } }}>
          <TableHead><TableRow>{tab === 'suggestions' ? ['Part Name', 'Part Number', 'In Stock', 'Minimum Level', 'Reorder Qty', 'Actions'].map(c => <TableCell key={c}>{c}</TableCell>) : columns.map(([label, field]) => <TableCell key={label}>{field ? <TableSortLabel active={sort === field} direction={sort === field ? direction : 'asc'} onClick={() => { setSort(field); setDirection(sort === field && direction === 'asc' ? 'desc' : 'asc'); setPage(0); }}>{label}</TableSortLabel> : label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{loading ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}>{Array.from({ length: tab === 'suggestions' ? 6 : 12 }, (_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>) : (tab === 'suggestions' ? suggestions.length : orders.length) === 0 ? <TableRow><TableCell colSpan={tab === 'suggestions' ? 6 : 12}><Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180, color: 'text.muted' }} spacing={1}><InboxOutlined sx={{ fontSize: 46, opacity: 0.45 }} /><Typography variant="body2">No data</Typography><Typography variant="caption">{search || status !== 'All' ? 'Try changing your search or filters.' : tab === 'suggestions' ? 'No parts need replenishment.' : 'Create an order to track incoming parts.'}</Typography>{canEdit && tab !== 'suggestions' && <Button variant="contained" onClick={() => openCreate()}>Create Order</Button>}</Stack></TableCell></TableRow> : tab === 'suggestions' ? suggestions.map(p => <TableRow key={p.id}><TableCell>{p.productName}</TableCell><TableCell>{p.productCode}</TableCell><TableCell>{p.inventory.quantity}</TableCell><TableCell>{p.inventory.minimumLevel}</TableCell><TableCell>{p.suggestedQuantity}</TableCell><TableCell>{canEdit && <Button onClick={() => openCreate(p)}>Create Order</Button>}</TableCell></TableRow>) : orders.flatMap(order => order.items.map((item, index) => <TableRow key={`${order.id}-${index}`} hover>
            <TableCell>{order.orderNumber}</TableCell><TableCell>{order.vendorName}<Typography variant="caption" display="block" color="text.secondary">{order.vendorPhone}</Typography></TableCell><TableCell>{item.partName}</TableCell><TableCell>{item.partNumber}</TableCell><TableCell>{item.vehicleType ? <Chip size="small" label={item.vehicleType} /> : '—'}</TableCell><TableCell>{item.quantity}</TableCell><TableCell><Chip size="small" label={item.partType || 'Other'} /></TableCell><TableCell>{order.customerName || '—'}</TableCell><TableCell>{formatDate(order.orderDate)}</TableCell><TableCell sx={{ color: order.status === 'Pending' && order.expectedDelivery && order.expectedDelivery.slice(0, 10) < new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) ? 'error.main' : 'text.primary' }}>{formatDate(order.expectedDelivery)}</TableCell><TableCell><Chip size="small" color={order.status === 'Received' ? 'success' : order.status === 'Pending' ? 'error' : 'default'} label={`● ${order.status}`} variant="outlined" /></TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{actionButton('View details', <VisibilityOutlined fontSize="small" />, () => setView(order))}{canEdit && order.status === 'Pending' && <>{!order.isDraft && actionButton('Mark as received', <CheckCircleOutline fontSize="small" />, () => setConfirm({ order, action: 'receive' }))}{(order.bulk || order.items.length === 1) && actionButton('Edit order', <EditOutlined fontSize="small" />, () => openEdit(order))}{actionButton('Cancel order', <CancelOutlined fontSize="small" />, () => setConfirm({ order, action: 'cancel' }))}</>}</TableCell>
          </TableRow>))}</TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={total} page={page} rowsPerPage={limit} rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={e => { setLimit(Number(e.target.value)); setPage(0); }} />
      </>}
      </Box>
      </>}
    </Card>
    <Drawer anchor="right" open={drawer} onClose={() => !busy && setDrawer(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 450 }, p: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}><Typography variant="h5">{editing ? 'Edit Order' : 'Create Order'}</Typography><IconButton aria-label="Close order form" disabled={busy} onClick={() => setDrawer(false)}><Close /></IconButton></Stack>
      <Box component="form" onSubmit={save}><Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField label="Vendor" required value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))} />
        <TextField label="Vendor phone / contact" value={form.vendorPhone} onChange={e => setForm(f => ({ ...f, vendorPhone: e.target.value }))} />
        <Autocomplete options={options} value={part} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={p => `${p.productName} (${p.productCode})`} filterOptions={x => x} onInputChange={(_, value, reason) => { if (reason === 'input') setPartQuery(value); }} onChange={(_, value) => { setPart(value); if (value) setForm(f => ({ ...f, unitPrice: String(value.pricing?.costPrice || 0), vendorName: f.vendorName || value.supplier?.supplierName || '', vendorPhone: f.vendorPhone || value.supplier?.supplierPhone || '' })); }} renderInput={p => <TextField {...p} label="Inventory part" required error={!!partError} helperText={partError || 'Search by part name or number'} />} />
        <Button onClick={() => { setNewPartError(''); setNewPartOpen(true); }} size="small">Add a new part to Inventory</Button>
        <Stack direction="row" spacing={2}><TextField label="Quantity" type="number" required value={form.quantity} inputProps={{ min: 0.001, step: 'any' }} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /><TextField label="Unit price (₹)" type="number" required value={form.unitPrice} inputProps={{ min: 0, step: '0.01' }} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} /></Stack>
        <TextField label="Customer name (optional)" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
        <TextField label="Estimated delivery" type="date" InputLabelProps={{ shrink: true }} value={form.expectedDelivery} onChange={e => setForm(f => ({ ...f, expectedDelivery: e.target.value }))} />
        <TextField label="Notes" multiline rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <Button type="submit" variant="contained" disabled={busy}>{busy ? <CircularProgress size={20} /> : editing ? 'Save Changes' : 'Create Order'}</Button>
      </Stack></Box>
    </Drawer>
    <PartFormDialog open={newPartOpen} item={null} categories={[]} saving={busy} error={newPartError} onClose={() => setNewPartOpen(false)} onSave={async payload => { setBusy(true); setNewPartError(''); try { const response = await api.post('/products', { ...payload, inventory: { ...payload.inventory, quantity: 0 } }); const product = response.data.data; setPart(product); setOptions(list => [product, ...list]); setForm(f => ({ ...f, unitPrice: String(product.pricing?.costPrice || 0) })); setNewPartOpen(false); } catch (e) { setNewPartError(errorMessage(e)); } finally { setBusy(false); } }} />
    <Dialog open={!!view} onClose={() => setView(null)} fullWidth><DialogTitle>Order {view?.orderNumber}</DialogTitle><DialogContent><Stack spacing={1}><Typography>{view?.vendorName} {view?.vendorPhone}</Typography><Typography>Customer: {view?.customerName || '—'}</Typography><Typography>Status: {view?.status}</Typography><Typography>Ordered: {formatDate(view?.orderDate)}</Typography><Typography>Expected: {formatDate(view?.expectedDelivery)}</Typography>{view?.receivedDate && <Typography>Received: {formatDate(view.receivedDate)}</Typography>}{view?.items.map((item, i) => <Typography key={i}>{item.partName} ({item.partNumber}) · {item.quantity} × {formatCurrency(item.unitPrice)}</Typography>)}<Typography fontWeight={700}>Total: {formatCurrency(view?.totalAmount)}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{view?.notes}</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setView(null)}>Close</Button></DialogActions></Dialog>
    <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)}><DialogTitle>{confirm?.action === 'receive' ? 'Receive order?' : 'Cancel order?'}</DialogTitle><DialogContent>{confirm?.action === 'receive' ? 'All ordered quantities will be added to Inventory and recorded in stock history.' : 'This pending order will be cancelled.'}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setConfirm(null)}>Back</Button><Button variant="contained" disabled={busy} onClick={runAction}>{busy ? 'Working…' : 'Confirm'}</Button></DialogActions></Dialog>

  </>;
}
