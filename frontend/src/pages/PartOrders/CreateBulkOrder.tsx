import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, InputAdornment, MenuItem, Paper, Skeleton, Stack, Step, StepButton, StepLabel, Stepper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Check, DeleteOutline, EditOutlined, Inventory2Outlined, QrCodeScanner, Search } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { showToast } from '../../redux/uiSlice';
import api from '../../services/api';
import { ordersApi, orderErrorMessage } from '../../services/partOrdersService';
import { useVendors, VENDOR_REQUIRED } from '../../services/vendorService';
import { money } from '../../services/purchaseInvoiceService';
import { calculateOrderLine, calculateOrderTotals } from '../../../../shared/partOrderPricing.mjs';
import useDebounce from '../../utils/useDebounce';
import InventoryPageHeader from '../Inventory/InventoryPageHeader';
import VendorSelect from './VendorSelect';
import AddBulkPartDrawer from './AddBulkPartDrawer';
interface Line { productId: string; partName: string; partNumber: string; vehicleType?: string; unit: string; hsn: string; unitPrice: string; quantity: string; taxPercent: string; discountType: 'Percentage' | 'Amount'; discountValue: string }
interface Form { orderDate: string; expectedDelivery: string; vendorId: string | null; vendorName: string; managePurchase: boolean; billNumber: string; billDate: string; items: Line[] }
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const blank = (): Form => ({ orderDate: today(), expectedDelivery: '', vendorId: null, vendorName: '', managePurchase: false, billNumber: '', billDate: '', items: [] });
export default function CreateBulkOrder() {
  const { id } = useParams(), navigate = useNavigate(), dispatch = useAppDispatch();
  const { toggleDrawer, registerNavigationGuard } = useOutletContext<{ toggleDrawer: () => void; registerNavigationGuard?: (guard: () => boolean) => () => void }>();
  const user = useAppSelector(state => state.auth.user), canEdit = ['Admin', 'Service Manager'].includes(user?.role || '');
  const { vendors, loading: vendorsLoading, error: vendorError, retry: retryVendors } = useVendors();
  const [form, setForm] = useState<Form>(blank), [step, setStep] = useState(0), [reachedSummary, setReachedSummary] = useState(false);
  const [loading, setLoading] = useState(!!id), [loadError, setLoadError] = useState(''), [loadVersion, setLoadVersion] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [version, setVersion] = useState(0), [existingDraft, setExistingDraft] = useState(true);
  const baseline = useRef(JSON.stringify(form)), saved = useRef(false);
  const [search, setSearch] = useState(''), q = useDebounce(search), [page, setPage] = useState(0), [parts, setParts] = useState<any[]>([]), [partTotal, setPartTotal] = useState(0), [partsLoading, setPartsLoading] = useState(true), [partsError, setPartsError] = useState(''), [partsVersion, setPartsVersion] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set()), [checkedParts, setCheckedParts] = useState<Record<string, any>>({});
  const [scannerOpen, setScannerOpen] = useState(false), [barcode, setBarcode] = useState('');
  const [partDrawerOpen, setPartDrawerOpen] = useState(false), [partDrawerDirty, setPartDrawerDirty] = useState(false);
  const isDirty = JSON.stringify(form) !== baseline.current || partDrawerDirty;
  const confirmLeave = useCallback(() => !isDirty || saved.current || window.confirm('Leave Bulk Order without saving? Your changes will be lost.'), [isDirty]);
  useEffect(() => registerNavigationGuard?.(confirmLeave), [confirmLeave, registerNavigationGuard]);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => { if (!saved.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setLoading(true); setLoadError('');
    ordersApi.get(id, controller.signal).then(order => {
      if (controller.signal.aborted) return;
      if (!order.bulk || order.status !== 'Pending') throw new Error('Only pending bulk orders can be edited.');
      const next: Form = { orderDate: order.orderDate.slice(0, 10), expectedDelivery: order.expectedDelivery?.slice(0, 10) || '', vendorId: order.vendorId || null, vendorName: order.vendorName || '', managePurchase: !!order.managePurchase, billNumber: order.billNumber || '', billDate: order.billDate?.slice(0, 10) || '', items: order.items.map(line => ({ productId: line.productId, partName: line.partName, partNumber: line.partNumber, vehicleType: line.vehicleType, unit: line.unit || 'Units', hsn: line.hsn || '', quantity: String(line.quantity), unitPrice: String(line.unitPrice), taxPercent: String(line.taxPercent || 0), discountType: line.discountType || 'Percentage', discountValue: String(line.discountValue || 0) })) };
      baseline.current = JSON.stringify(next); setForm(next); setVersion(order.__v || 0); setExistingDraft(!!order.isDraft);
    }).catch(e => { if (!controller.signal.aborted) setLoadError(orderErrorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, loadVersion]);
  useEffect(() => {
    const controller = new AbortController(); setPartsLoading(true); setPartsError('');
    api.get('/products', { params: { q, page: page + 1, limit: 15 }, signal: controller.signal }).then(response => { if (!controller.signal.aborted) { setParts(response.data.data); setPartTotal(response.data.pagination.total); } }).catch(e => { if (!controller.signal.aborted) setPartsError(orderErrorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setPartsLoading(false); });
    return () => controller.abort();
  }, [q, page, partsVersion]);
  const change = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));
  const updateLine = (productId: string, patch: Partial<Line>) => setForm(f => ({ ...f, items: f.items.map(line => line.productId === productId ? { ...line, ...patch } : line) }));
  const remove = (productId: string) => setForm(f => ({ ...f, items: f.items.filter(line => line.productId !== productId) }));
  const totals = useMemo(() => { try { return calculateOrderTotals(form.items); } catch { return null; } }, [form.items]);
  const vendor = vendors.find(v => v.id === form.vendorId);
  const vendorProps = { value: form.vendorId, onChange: (value: string | null) => setForm(f => ({ ...f, vendorId: value, vendorName: vendors.find(v => v.id === value)?.name || '' })), vendors, loading: vendorsLoading, disabled: busy, snapshotName: form.vendorName };
  const validate = () => {
    if (VENDOR_REQUIRED && !form.vendorId) return 'Choose a vendor.';
    if (!form.items.length) return 'Add at least one part.';
    if (!form.orderDate || !Number.isFinite(new Date(form.orderDate).getTime())) return 'Choose a valid order date.';
    if (form.expectedDelivery && form.expectedDelivery < form.orderDate) return 'Estimated delivery must be on or after the order date.';
    for (const line of form.items) {
      if (line.quantity.trim() === '' || line.unitPrice.trim() === '') return `Enter a quantity and rate for ${line.partName}.`;
      try { calculateOrderLine(line); } catch (e) { return `${line.partName}: ${(e as Error).message}`; }
    }
    return '';
  };
  const next = () => { const problem = validate(); setError(problem); if (!problem) { setStep(1); setReachedSummary(true); } };
  const addChecked = () => {
    const added = [...checked].filter(productId => !form.items.some(line => line.productId === productId));
    if (form.items.length + added.length > 100) { setError('An order can contain at most 100 parts.'); return; }
    setForm(f => ({ ...f, items: [...f.items, ...added.map(productId => { const product = checkedParts[productId]; return { productId, partName: product.productName, partNumber: product.productCode, vehicleType: product.vehicleType, unit: product.inventory?.unit || 'Units', hsn: product.hsn || '', unitPrice: String(product.pricing?.costPrice || 0), quantity: '1', taxPercent: String(product.pricing?.purchaseTaxPercent ?? product.pricing?.tax ?? 0), discountType: 'Amount' as const, discountValue: String(product.pricing?.purchaseDiscountAmount || 0) }; })] }));
    setChecked(new Set()); setCheckedParts({}); setError('');
  };
  const save = async (intent: 'draft' | 'finalize') => {
    const problem = validate(); setError(problem); if (problem) return;
    setBusy(true);
    try {
      const order = await ordersApi.saveBulk({ ...form, intent, version, items: form.items.map(line => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxPercent: Number(line.taxPercent), discountValue: Number(line.discountValue) })) }, id);
      saved.current = true;
      dispatch(showToast({ severity: 'success', message: intent === 'draft' ? 'Bulk order saved as draft.' : 'Bulk order and purchase invoice created.' }));
      navigate(`/part-orders?tab=bulk${intent === 'finalize' ? `&invoice=${order.id}` : ''}`);
    } catch (e) { const message = orderErrorMessage(e); setError(message); dispatch(showToast({ severity: 'error', message })); } finally { setBusy(false); }
  };
  const lineField = (line: Line, field: 'unitPrice' | 'quantity' | 'taxPercent' | 'discountValue') => <TextField id={`${field}-${line.productId}`} size="small" type="number" value={line[field]} onChange={e => updateLine(line.productId, { [field]: e.target.value })} inputProps={{ min: field === 'quantity' ? 0.001 : 0, max: field === 'taxPercent' || (field === 'discountValue' && line.discountType === 'Percentage') ? 100 : undefined, step: 'any', 'aria-label': `${field === 'unitPrice' ? 'Rate' : field === 'quantity' ? 'Quantity' : field === 'taxPercent' ? 'Tax percent' : 'Discount'} for ${line.partName}` }} sx={{ width: 95 }} />;
  const selectedTable = (summary: boolean) => <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" aria-label={summary ? 'Order summary lines' : 'Selected parts'} sx={{ minWidth: summary ? 1100 : 850, '& th': { color: 'text.secondary', whiteSpace: 'nowrap' }, '& td': { py: 1 } }}>
    <TableHead><TableRow>{(summary ? ['Type', 'Part Name', 'Part Number', 'HSN', 'Unit', 'Price/Unit', 'Qty', 'Tax', 'Discount', 'Total', ''] : ['Part Name', 'Part Number', 'Rate', 'Quantity', 'Tax', 'Discount', '']).map((title, index) => <TableCell key={`${title}-${index}`}>{title}</TableCell>)}</TableRow></TableHead>
    <TableBody>{!form.items.length ? <TableRow><TableCell colSpan={summary ? 11 : 7} sx={{ height: 100, textAlign: 'center', color: 'text.secondary' }}>Add parts from Inventory</TableCell></TableRow> : form.items.map(line => {
      let amount: number | undefined; try { amount = calculateOrderLine(line).totalAmount; } catch { /* Validation displays above the form. */ }
      return <TableRow key={line.productId}>{summary && <TableCell><Stack direction="row" spacing={0.5} alignItems="center"><Inventory2Outlined fontSize="small" /><Typography variant="caption">Parts</Typography></Stack></TableCell>}
        <TableCell sx={{ minWidth: 140 }}>{line.partName}{summary && <Tooltip title="Edit rate"><IconButton size="small" aria-label={`Edit ${line.partName}`} onClick={() => document.getElementById(`unitPrice-${line.productId}`)?.focus()}><EditOutlined sx={{ fontSize: 15 }} /></IconButton></Tooltip>}</TableCell><TableCell>{line.partNumber}</TableCell>
        {summary && <><TableCell><TextField size="small" value={line.hsn} placeholder="—" onChange={e => updateLine(line.productId, { hsn: e.target.value })} inputProps={{ 'aria-label': `HSN for ${line.partName}`, maxLength: 30 }} sx={{ width: 90 }} /></TableCell><TableCell>{line.unit}</TableCell></>}
        <TableCell>{lineField(line, 'unitPrice')}</TableCell><TableCell>{lineField(line, 'quantity')}</TableCell><TableCell>{lineField(line, 'taxPercent')}</TableCell>
        <TableCell><Stack direction="row" spacing={0.5}>{lineField(line, 'discountValue')}<TextField select size="small" value={line.discountType} onChange={e => updateLine(line.productId, { discountType: e.target.value as Line['discountType'] })} inputProps={{ 'aria-label': `Discount type for ${line.partName}` }} sx={{ width: 100 }}><MenuItem value="Percentage">%</MenuItem><MenuItem value="Amount">₹ / unit</MenuItem></TextField></Stack></TableCell>
        {summary && <TableCell sx={{ whiteSpace: 'nowrap' }}>{amount === undefined ? '—' : money(amount)}</TableCell>}
        <TableCell><Tooltip title="Remove part"><IconButton color="error" size="small" aria-label={`Remove ${line.partName}`} onClick={() => remove(line.productId)}><DeleteOutline fontSize="small" /></IconButton></Tooltip></TableCell>
      </TableRow>;
    })}</TableBody>
  </Table></TableContainer>;
  return <Box sx={{ pb: 2 }}>
    <InventoryPageHeader title={id ? 'Edit Bulk Order' : 'Create Bulk Order'} avatarLabel={(user?.name || user?.email || 'A').charAt(0).toUpperCase()} onMenuClick={toggleDrawer} />
    {!canEdit ? <Alert severity="info">Your role can view orders. An Admin or Service Manager can create and edit them.</Alert> : loading ? <Skeleton variant="rounded" height={400} /> : loadError ? <Alert severity="error" action={<Button onClick={() => setLoadVersion(v => v + 1)}>Retry</Button>}>{loadError}</Alert> : <>
      <Stepper activeStep={step} alternativeLabel nonLinear sx={{ maxWidth: 780, mx: 'auto', mb: 3 }}>{['Details', 'Order Summary'].map((label, index) => <Step key={label} completed={index === 0 && reachedSummary}><StepButton disabled={busy || (index === 1 && !reachedSummary)} onClick={() => index === 0 ? setStep(0) : next()}><StepLabel StepIconComponent={() => <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', border: 1, borderColor: index === 0 && reachedSummary ? 'success.main' : 'primary.main', bgcolor: index === 0 && reachedSummary ? 'success.main' : step === index ? 'primary.main' : 'background.paper', color: step === index || (index === 0 && reachedSummary) ? 'primary.contrastText' : 'primary.main' }}>{index === 0 && reachedSummary ? <Check fontSize="small" /> : index + 1}</Box>}>{label}</StepLabel></StepButton></Step>)}</Stepper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {vendorError && <Alert severity="warning" action={<Button onClick={retryVendors}>Retry</Button>} sx={{ mb: 2 }}>{vendorError} You can save without a vendor.</Alert>}
      {form.items.some(line => Number(line.unitPrice) === 0) && <Alert severity="warning" sx={{ mb: 2 }}>Some parts have a ₹0 purchase rate. You can continue or enter their rate.</Alert>}
      <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      {step === 0 ? <Card sx={{ p: { xs: 1.5, sm: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2.5 }}>
        <Card variant="outlined" sx={{ p: 2, boxShadow: 'none', minWidth: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}><TextField label="Order Date" type="date" size="small" required value={form.orderDate} onChange={e => change('orderDate', e.target.value)} InputLabelProps={{ shrink: true }} /><TextField label="Est. Delivery" type="date" size="small" value={form.expectedDelivery} onChange={e => change('expectedDelivery', e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: form.orderDate }} /><VendorSelect {...vendorProps} /></Box>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center"><TextField fullWidth size="small" placeholder="Search Parts" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} inputProps={{ 'aria-label': 'Search Inventory parts by name, number or barcode' }} InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} /><Tooltip title="Scan or enter barcode"><IconButton aria-label="Scan barcode" onClick={() => { setBarcode(''); setScannerOpen(true); }}><QrCodeScanner /></IconButton></Tooltip><Button variant="contained" startIcon={<Add />} disabled={form.items.length >= 100} onClick={() => setPartDrawerOpen(true)}>Add</Button></Stack>
            {!!checked.size && <Button size="small" variant="outlined" onClick={addChecked} sx={{ mt: 1 }}>Add Selected ({checked.size})</Button>}
            {partsError ? <Alert severity="error" sx={{ mt: 1 }} action={<Button onClick={() => setPartsVersion(v => v + 1)}>Retry</Button>}>{partsError}</Alert> : <Box sx={{ height: 285, overflowY: 'auto', mt: 1 }}>
              {partsLoading ? Array.from({ length: 7 }, (_, i) => <Skeleton key={i} height={38} />) : !parts.length ? <Typography color="text.secondary" sx={{ p: 2 }}>No parts found</Typography> : parts.map(product => { const added = form.items.some(line => line.productId === product.id); return <Box key={product.id} component="label" sx={{ display: 'grid', gridTemplateColumns: '28px minmax(80px,1fr) minmax(65px,.7fr) 65px 85px', alignItems: 'center', gap: 0.5, py: 0.25, cursor: added ? 'default' : 'pointer' }}><Checkbox size="small" checked={added || checked.has(product.id)} disabled={added} inputProps={{ 'aria-label': `Select ${product.productName}` }} onChange={e => { const enabled = e.target.checked; setChecked(old => { const nextSet = new Set(old); if (enabled) nextSet.add(product.id); else nextSet.delete(product.id); return nextSet; }); setCheckedParts(old => ({ ...old, [product.id]: product })); }} /><Tooltip title={product.productName}><Typography noWrap variant="body2" fontWeight={600}>{product.productName}</Typography></Tooltip><Typography variant="caption" noWrap>{product.productCode}</Typography><Typography variant="caption">Qty: {product.inventory?.quantity || 0}</Typography><Typography variant="caption" textAlign="right">{money(product.pricing?.costPrice || 0)}</Typography></Box>; })}
            </Box>}
            <TablePagination component="div" count={partTotal} page={page} rowsPerPage={15} rowsPerPageOptions={[15]} onPageChange={(_, nextPage) => setPage(nextPage)} sx={{ '& .MuiTablePagination-toolbar': { px: 0 }, '& .MuiTablePagination-selectLabel': { display: 'none' } }} />
          </Box>
        </Card>
        <Card variant="outlined" sx={{ p: 2, boxShadow: 'none', minWidth: 0 }}><Typography variant="subtitle1" textAlign="center" sx={{ mb: 2 }}>Part Details</Typography>{selectedTable(false)}<Stack direction="row" justifyContent="space-around" alignItems="center" sx={{ mt: 2 }}><Typography color="accent.main" fontWeight={700}>Total:</Typography><Chip variant="outlined" label={`${form.items.length} Item${form.items.length === 1 ? '' : 's'}`} /><Chip variant="outlined" label={totals ? money(totals.totalAmount) : '—'} sx={{ color: 'accent.main', fontWeight: 700 }} /></Stack></Card>
      </Card> : <Stack spacing={2}>
        <Card sx={{ p: 1.5 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1}><Typography variant="body2">Vendor: {vendor?.name || form.vendorName || 'N/A'} · Contact: {vendor?.phone || 'N/A'} · State: {vendor?.state || 'N/A'} · GSTIN: {vendor?.gstNumber || 'N/A'}</Typography><Button size="small" startIcon={<EditOutlined />} onClick={() => setStep(0)}>Edit</Button><Chip variant="outlined" label={existingDraft ? 'Draft / Pending' : 'Pending'} /><TextField size="small" label="Order Date" type="date" value={form.orderDate} onChange={e => change('orderDate', e.target.value)} InputLabelProps={{ shrink: true }} /></Stack></Card>
        <Card sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Typography variant="subtitle1">Part Details</Typography><Button variant="outlined" startIcon={<Add />} onClick={() => setStep(0)}>Add More</Button></Stack>{selectedTable(true)}</Card>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 2, alignItems: 'start' }}>
          <Card sx={{ p: 2 }}><FormControlLabel control={<Checkbox checked={form.managePurchase} onChange={e => change('managePurchase', e.target.checked)} />} label={<Typography fontWeight={700} color="accent.main">Manage Purchase</Typography>} /><Collapse in={form.managePurchase} timeout="auto"><Stack spacing={2} sx={{ pt: 1 }}><VendorSelect {...vendorProps} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField fullWidth label="Bill Number" value={form.billNumber} onChange={e => change('billNumber', e.target.value)} /><TextField fullWidth label="Bill Date" type="date" value={form.billDate} onChange={e => change('billDate', e.target.value)} InputLabelProps={{ shrink: true }} /></Stack></Stack></Collapse>{!form.managePurchase && <Typography variant="body2" color="text.secondary">Enable to enter vendor bill details.</Typography>}</Card>
          <Card sx={{ p: 2 }}><Typography variant="subtitle2">Billing Summary</Typography><Divider sx={{ my: 1 }} />{[['Subtotal', totals?.subtotal, ''], ['Total Discount', totals?.discountTotal, '− '], ['Total GST/Tax', totals?.taxAmount, '+ ']].map(([label, value, prefix]) => <Stack key={String(label)} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}><Typography variant="body2">{label}</Typography><Typography variant="body2">{value === undefined ? '—' : `${prefix}${money(Number(value))}`}</Typography></Stack>)}<Divider sx={{ my: 1 }} /><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Grand Total</Typography><Typography fontWeight={800} color="accent.main">{totals ? money(totals.totalAmount) : '—'}</Typography></Stack></Card>
        </Box>
      </Stack>}
      </Box>
      <Paper elevation={2} sx={{ position: 'sticky', bottom: 0, zIndex: 2, mt: 3, p: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
        <Typography fontWeight={700} color="accent.main">{step === 1 ? `Grand Total: ${totals ? money(totals.totalAmount) : '—'}` : ''}</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {step === 1 && <Tooltip title={id && !existingDraft ? 'Use Create Order to update the finalized invoice' : 'Save as draft without an invoice'}><span><Button variant="contained" color="success" disabled={busy || (!!id && !existingDraft)} onClick={() => save('draft')} sx={{ width: { xs: '100%', sm: 'auto' } }}>Save</Button></span></Tooltip>}
          <Button variant="outlined" disabled={busy} onClick={() => step === 1 ? setStep(0) : navigate('/part-orders?tab=bulk')}>Back</Button>
          <Button variant="contained" disabled={busy} onClick={() => step === 0 ? next() : save('finalize')} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}>{busy ? 'Saving…' : step === 0 ? 'Save & Next' : 'Create Order'}</Button>
        </Stack>
      </Stack></Paper>
    </>}
    <AddBulkPartDrawer open={partDrawerOpen} onClose={() => setPartDrawerOpen(false)} onDirtyChange={setPartDrawerDirty} onCreated={(product, line) => {
      setForm(current => ({ ...current, items: [...current.items, { productId: product.id, partName: product.productName, partNumber: product.productCode, vehicleType: product.vehicleType, unit: line.unit, hsn: line.hsn, quantity: String(line.quantity), unitPrice: String(line.unitPrice), taxPercent: String(line.taxPercent), discountType: line.discountType, discountValue: String(line.discountValue) }] }));
      setPartsVersion(value => value + 1); setError('');
      dispatch(showToast({ severity: 'success', message: 'Part created and added to the order.' }));
    }} />
    <Dialog open={scannerOpen} onClose={() => setScannerOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Scan Barcode</DialogTitle><DialogContent><Typography variant="body2" sx={{ mb: 2 }}>Use your barcode scanner or enter the barcode, then search Inventory.</Typography><TextField autoFocus fullWidth label="Barcode" value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && barcode.trim()) { e.preventDefault(); setSearch(barcode.trim()); setPage(0); setScannerOpen(false); } }} /></DialogContent><DialogActions><Button onClick={() => setScannerOpen(false)}>Close</Button><Button disabled={!barcode.trim()} onClick={() => { setSearch(barcode.trim()); setPage(0); setScannerOpen(false); }}>Search</Button></DialogActions></Dialog>
  </Box>;
}
