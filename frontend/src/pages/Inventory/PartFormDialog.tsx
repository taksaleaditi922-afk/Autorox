import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, MenuItem, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { InventoryItem } from '../../services/inventoryService';

const CATEGORY_SUBCATEGORIES: Record<string, string[]> = {
  Brakes: ['Brake Pads', 'Brake Shoes', 'Discs & Drums', 'Brake Fluid'],
  Engine: ['Filters', 'Belts', 'Gaskets', 'Spark Plugs'],
  Electrical: ['Battery', 'Lighting', 'Switches', 'Wiring'],
  Suspension: ['Shock Absorbers', 'Bushes', 'Bearings'],
  'Oils & Fluids': ['Engine Oil', 'Coolant', 'Brake Fluid', 'Gear Oil'],
  Body: ['Panels', 'Mirrors', 'Trim', 'Wipers'],
  Tyres: ['Tyres', 'Tubes', 'Valves'],
  Other: ['General'],
};

const EMPTY_FORM = {
  barcode: '', productName: '', productCode: '', vehicleType: '', category: '', subCategory: '',
  location: '', purchasePrice: '', sellingPrice: '', openingQuantity: '0', partType: '',
  remark: '', minimumLevel: '5',
};

interface Props {
  open: boolean;
  item: InventoryItem | null;
  categories: string[];
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (payload: Record<string, any>) => Promise<void>;
}

export default function PartFormDialog({ open, item, categories, saving, error, onClose, onSave }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [attempted, setAttempted] = useState(false);
  const editing = Boolean(item);

  useEffect(() => {
    if (!open) return;
    setAttempted(false);
    setForm(item ? {
      barcode: item.barcode || '',
      productName: item.productName || '',
      productCode: item.productCode || '',
      vehicleType: item.vehicleType || '',
      category: item.category || '',
      subCategory: item.subCategory || '',
      location: item.inventory?.location || '',
      purchasePrice: String(item.pricing?.costPrice ?? ''),
      sellingPrice: String(item.pricing?.sellingPrice ?? ''),
      openingQuantity: '0',
      partType: item.partType || '',
      remark: item.remark || '',
      minimumLevel: String(item.inventory?.minimumLevel ?? 5),
    } : EMPTY_FORM);
  }, [open, item]);

  const categoryOptions = useMemo(() => Array.from(new Set([...Object.keys(CATEGORY_SUBCATEGORIES), ...categories])).sort(), [categories]);
  const subCategories = CATEGORY_SUBCATEGORIES[form.category] || (form.subCategory ? [form.subCategory] : []);
  const purchase = Number(form.purchasePrice);
  const selling = Number(form.sellingPrice);
  const margin = purchase > 0 && Number.isFinite(selling) ? ((selling - purchase) / purchase) * 100 : 0;
  const requiredMissing = !form.productName.trim() || !form.productCode.trim() || !form.vehicleType || !form.partType ||
    form.purchasePrice === '' || form.sellingPrice === '';
  const invalidNumbers = !Number.isFinite(purchase) || purchase < 0 || !Number.isFinite(selling) || selling < 0 ||
    Number(form.openingQuantity) < 0 || Number(form.minimumLevel) < 0;

  const submit = async () => {
    setAttempted(true);
    if (requiredMissing || invalidNumbers) return;
    await onSave({
      productCode: form.productCode.trim(),
      productName: form.productName.trim(),
      barcode: form.barcode.trim() || undefined,
      vehicleType: form.vehicleType,
      category: form.category,
      subCategory: form.subCategory,
      partType: form.partType,
      remark: form.remark.trim(),
      pricing: { costPrice: purchase, sellingPrice: selling },
      inventory: {
        ...(editing ? {} : { quantity: Number(form.openingQuantity) || 0 }),
        minimumLevel: Number(form.minimumLevel) || 0,
        location: form.location.trim(),
      },
    });
  };

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{editing ? 'Edit Part' : 'Add New Part'}</Typography>
        <IconButton aria-label="Close" onClick={onClose} disabled={saving}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {error && <Grid item xs={12}><Alert severity="error">{error}</Alert></Grid>}
          <Grid item xs={12} md={6}><TextField fullWidth required label="Part Name" error={attempted && !form.productName.trim()} {...field('productName')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth required label="Part Number" error={attempted && !form.productCode.trim()} {...field('productCode')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label="Barcode" helperText="Optional, but must be unique when supplied" {...field('barcode')} /></Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth required label="Vehicle Type" error={attempted && !form.vehicleType} {...field('vehicleType')}>
              <MenuItem value="2W">2W</MenuItem><MenuItem value="4W">4W</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Category" {...field('category')} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, subCategory: '' }))}>
              <MenuItem value="">None</MenuItem>{categoryOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Sub Category" disabled={!form.category} {...field('subCategory')}>
              <MenuItem value="">None</MenuItem>{subCategories.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label="Location" {...field('location')} /></Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth required label="Part Type" error={attempted && !form.partType} {...field('partType')}>
              {['OEM', 'Aftermarket', 'Other'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}><TextField fullWidth required type="number" label="Purchase Price" InputProps={{ startAdornment: <Box component="span" sx={{ mr: 1 }}>₹</Box> }} inputProps={{ min: 0, step: '0.01' }} error={attempted && (form.purchasePrice === '' || purchase < 0)} {...field('purchasePrice')} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth required type="number" label="Selling Price" InputProps={{ startAdornment: <Box component="span" sx={{ mr: 1 }}>₹</Box> }} inputProps={{ min: 0, step: '0.01' }} error={attempted && (form.sellingPrice === '' || selling < 0)} {...field('sellingPrice')} /></Grid>
          {!editing && <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Opening Quantity" inputProps={{ min: 0, step: 1 }} {...field('openingQuantity')} /></Grid>}
          <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Low Stock Threshold" inputProps={{ min: 0, step: 1 }} {...field('minimumLevel')} /></Grid>
          <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Remark" {...field('remark')} /></Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color={margin < 0 ? 'error.main' : 'success.main'} fontWeight={700}>Margin: {margin.toFixed(2)}%</Typography>
            {selling < purchase && <Alert severity="warning" sx={{ mt: 1 }}>Selling price is lower than purchase price.</Alert>}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Part'}</Button>
      </DialogActions>
    </Dialog>
  );
}
