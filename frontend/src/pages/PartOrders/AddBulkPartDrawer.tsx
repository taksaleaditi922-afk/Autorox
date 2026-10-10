import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControlLabel, Grid, IconButton, InputAdornment, MenuItem, Radio, RadioGroup, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { AutoAwesome, Close } from '@mui/icons-material';
import { PriceDetailsCard } from '../Inventory/AddPartPage';
import { CATEGORY_SUBCATEGORIES } from '../Inventory/PartFormDialog';
import { createInventoryProduct } from '../../services/inventoryService';
import { discountAmountFromPercent, discountPercentFromAmount } from '../../utils/inventoryPriceCalculations';
import { bulkPartTotals, emptyBulkPart, prepareBulkPart, type BulkPartForm } from '../../utils/bulkPartCreation';
import { orderErrorMessage } from '../../services/partOrdersService';
import type { InventoryItem } from '../../services/inventoryService';
interface Props {
  open: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onCreated: (product: InventoryItem, line: ReturnType<typeof prepareBulkPart>['orderLine']) => void;
}
export default function AddBulkPartDrawer({ open, onClose, onDirtyChange, onCreated }: Props) {
  const [form, setForm] = useState(emptyBulkPart), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [units, setUnits] = useState(['Units', 'Piece', 'Pair', 'Set', 'Box']), [unitOpen, setUnitOpen] = useState(false), [newUnit, setNewUnit] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyBulkPart());
  useEffect(() => { if (open) { setForm(emptyBulkPart()); setError(''); setUnitOpen(false); } }, [open]);
  useEffect(() => onDirtyChange(open && dirty), [open, dirty, onDirtyChange]);
  const change = (key: keyof BulkPartForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  const close = () => { if (!saving && (!dirty || window.confirm('Discard the new part details?'))) onClose(); };
  const priceChange = (prefix: 'purchase' | 'sale', kind: 'Rate' | 'DiscountPercent' | 'DiscountAmount', value: string) => setForm(current => {
    const next = { ...current, [`${prefix}${kind}`]: value };
    if (kind === 'Rate') next[`${prefix}DiscountAmount`] = String(discountAmountFromPercent(Number(value) || 0, Number(current[`${prefix}DiscountPercent`]) || 0));
    else if (kind === 'DiscountPercent') next[`${prefix}DiscountAmount`] = String(discountAmountFromPercent(Number(current[`${prefix}Rate`]) || 0, Number(value) || 0));
    else next[`${prefix}DiscountPercent`] = String(discountPercentFromAmount(Number(current[`${prefix}Rate`]) || 0, Number(value) || 0));
    return next;
  });
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    setError('');
    try {
      const { payload, orderLine } = prepareBulkPart(form);
      setSaving(true);
      const product = await createInventoryProduct(payload);
      onCreated(product, orderLine); onClose();
    } catch (e) { setError(orderErrorMessage(e)); } finally { setSaving(false); }
  };
  const field = (key: keyof BulkPartForm) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(key, event.target.value) });
  const priceCard = (sale: boolean) => {
    const prefix = sale ? 'sale' : 'purchase';
    return <PriceDetailsCard compact title={sale ? 'Sale Price (per item)' : 'Purchase Price'} rateLabel="Rate" rate={form[`${prefix}Rate`]} discountPercent={form[`${prefix}DiscountPercent`]} discountAmount={form[`${prefix}DiscountAmount`]} taxType={form[`${prefix}TaxType`]} taxPercent={form[`${prefix}TaxPercent`]} totals={bulkPartTotals(form, sale)} attempted={false} requiredRate onRateChange={value => priceChange(prefix, 'Rate', value)} onDiscountPercentChange={value => priceChange(prefix, 'DiscountPercent', value)} onDiscountAmountChange={value => priceChange(prefix, 'DiscountAmount', value)} onTaxTypeChange={value => setForm(current => ({ ...current, [`${prefix}TaxType`]: value, [`${prefix}TaxPercent`]: value === 'NONE' ? '' : current[`${prefix}TaxPercent`] }))} onTaxPercentChange={value => change(`${prefix}TaxPercent`, value)} />;
  };
  return <Drawer anchor="right" sx={{ zIndex: theme => theme.zIndex.modal + 1 }} open={open} onClose={close} PaperProps={{ role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'new-bulk-part-title', sx: { width: { xs: '100%', md: 720 }, maxWidth: '100vw' } }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}><IconButton aria-label="Close add new part" disabled={saving} onClick={close}><Close fontSize="small" /></IconButton><Typography id="new-bulk-part-title" variant="subtitle1">Add New Part</Typography></Stack>
    <Box component="form" onSubmit={create} sx={{ p: 2 }}><Box component="fieldset" disabled={saving} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction="row" alignItems="center" spacing={1}><Typography variant="body2">Vehicle Type:</Typography><RadioGroup row aria-label="New part vehicle type" value={form.vehicleType} onChange={e => change('vehicleType', e.target.value)}><FormControlLabel value="4W" control={<Radio size="small" />} label="4W" /><FormControlLabel value="2W" control={<Radio size="small" />} label="2W" /></RadioGroup></Stack>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={4}><TextField autoFocus fullWidth size="small" required label="Part Number" {...field('productCode')} InputProps={{ endAdornment: <InputAdornment position="end"><Tooltip title="Generate part number"><IconButton size="small" aria-label="Generate part number" onClick={() => change('productCode', `PN-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`)}><AutoAwesome fontSize="small" /></IconButton></Tooltip></InputAdornment> }} /></Grid>
        <Grid item xs={12} sm={4}><TextField fullWidth size="small" required label="Part Name" {...field('productName')} /></Grid>
        <Grid item xs={12} sm={4}><TextField select fullWidth size="small" required label="Part Type" {...field('partType')}>{['OEM', 'Aftermarket', 'Other'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Brand Name" {...field('brand')} /></Grid>
        <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="HSN" inputProps={{ maxLength: 30 }} {...field('hsn')} /></Grid>
        <Grid item xs={12} sm={4}><TextField select fullWidth size="small" label="Category" {...field('category')} onChange={e => setForm(current => ({ ...current, category: e.target.value, subCategory: '' }))}><MenuItem value="">None</MenuItem>{Object.keys(CATEGORY_SUBCATEGORIES).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} sm={4}><TextField select fullWidth size="small" label="Sub Category" disabled={!form.category} {...field('subCategory')}><MenuItem value="">None</MenuItem>{(CATEGORY_SUBCATEGORIES[form.category] || []).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
      </Grid>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ my: 2 }}><TextField fullWidth size="small" type="number" required label="Quantity" inputProps={{ min: 0.001, step: 'any' }} {...field('quantity')} /><TextField select fullWidth size="small" label="Unit" {...field('unit')}>{units.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><Button variant="outlined" startIcon={<span>+</span>} sx={{ borderStyle: 'dashed', minWidth: 100 }} onClick={() => { setNewUnit(''); setUnitOpen(true); }}>ADD</Button></Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 1.5 }}>{priceCard(false)}{priceCard(true)}</Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Quantity is added to this order. Inventory stock is updated when the order is received.</Typography>
      <Stack direction="row" justifyContent="center" spacing={1.5} sx={{ mt: 2 }}><Button variant="outlined" disabled={saving} onClick={close}>Cancel</Button><Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}>{saving ? 'Creating…' : 'Create'}</Button></Stack>
    </Box></Box>
    <Dialog sx={{ zIndex: theme => theme.zIndex.modal + 2 }} open={unitOpen} onClose={() => setUnitOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Add Unit</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Unit name" inputProps={{ maxLength: 30 }} value={newUnit} onChange={e => setNewUnit(e.target.value)} /></DialogContent><DialogActions><Button onClick={() => setUnitOpen(false)}>Cancel</Button><Button disabled={!newUnit.trim()} onClick={() => { const unit = newUnit.trim(); setUnits(current => [...new Set([...current, unit])]); change('unit', unit); setUnitOpen(false); }}>Add</Button></DialogActions></Dialog>
  </Drawer>;
}
