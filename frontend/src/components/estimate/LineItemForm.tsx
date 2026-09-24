// ---------------------------------------------------------------------------
// Line item editor.
//
// Used for "Custom" items and for editing anything already in the estimate.
// The preview at the bottom comes from the same tax engine the estimate totals
// use, so what the advisor sees here is what gets charged.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UNITS, TAX_RATES } from '../../services/estimate/config';
import { calculateTax, formatMoney } from '../../utils/estimateMath';
import { validateLineItem } from '../../utils/estimateValidation';
import { newId } from '../../utils/id';
import type { DiscountType, EstimateLineItem, LineItemType, TaxType } from '../../services/estimate/types';
import { FieldError } from './primitives';

const ITEM_TYPES: { value: LineItemType; label: string }[] = [
  { value: 'service', label: 'Service' },
  { value: 'package', label: 'Package' },
  { value: 'part', label: 'Part' },
  { value: 'labour', label: 'Labour' },
  { value: 'custom', label: 'Custom' },
];

const CURRENCY = 'INR';

function makeBlank(defaultTaxRate: number): EstimateLineItem {
  return {
    id: newId('item'),
    type: 'custom',
    name: '',
    description: '',
    hsnSacCode: '',
    partNumber: '',
    brand: '',
    unit: 'Pcs',
    quantity: 1,
    rate: 0,
    discountType: 'none',
    discountValue: 0,
    taxType: 'GST',
    taxRate: defaultTaxRate,
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    total: 0,
  };
}

export interface LineItemFormProps {
  open: boolean;
  initial?: EstimateLineItem | null;
  defaultTaxRate?: number;
  onSave: (item: EstimateLineItem) => void;
  onClose: () => void;
}

export default function LineItemForm({ open, initial, defaultTaxRate = 18, onSave, onClose }: LineItemFormProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [form, setForm] = useState<EstimateLineItem>(() => (initial ? { ...initial } : makeBlank(defaultTaxRate)));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : makeBlank(defaultTaxRate));
      setTouched(false);
    }
  }, [open, initial, defaultTaxRate]);

  const set = (patch: Partial<EstimateLineItem>) => setForm((f) => ({ ...f, ...patch }));

  const preview = useMemo(() => calculateTax(form), [form]);
  const errors = useMemo(() => validateLineItem(form), [form]);
  const showErrors = touched && Object.keys(errors).length > 0;

  const handleSave = () => {
    setTouched(true);
    if (Object.keys(validateLineItem(form)).length) return;
    onSave({
      ...form,
      quantity: Number(form.quantity),
      rate: Number(form.rate),
      discountValue: Number(form.discountValue) || 0,
      taxRate: Number(form.taxRate) || 0,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen} aria-labelledby="line-item-dialog-title">
      <DialogTitle id="line-item-dialog-title">{initial ? 'Edit Item' : 'Add Custom Item'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              required
              label="Item Name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              error={Boolean(errors.name)}
              helperText={errors.name}
              autoFocus
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth label="Item Type" value={form.type} onChange={(e) => set({ type: e.target.value as LineItemType })}>
              {ITEM_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              minRows={2}
              value={form.description || ''}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField fullWidth label="HSN / SAC Code" value={form.hsnSacCode || ''} onChange={(e) => set({ hsnSacCode: e.target.value })} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth label="Part Number" value={form.partNumber || ''} onChange={(e) => set({ partNumber: e.target.value })} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth label="Brand" value={form.brand || ''} onChange={(e) => set({ brand: e.target.value })} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField select fullWidth label="Unit" value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
              {UNITS.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              required
              type="number"
              label="Quantity"
              value={form.quantity}
              onChange={(e) => set({ quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
              error={Boolean(errors.quantity)}
              helperText={errors.quantity}
              inputProps={{ min: 0, step: '0.5' }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              required
              type="number"
              label="Rate"
              value={form.rate}
              onChange={(e) => set({ rate: e.target.value === '' ? 0 : Number(e.target.value) })}
              error={Boolean(errors.rate)}
              helperText={errors.rate}
              inputProps={{ min: 0, step: '0.01' }}
              InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.muted' }}>₹</Typography> }}
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField
              select
              fullWidth
              label="Discount Type"
              value={form.discountType}
              onChange={(e) => {
                const discountType = e.target.value as DiscountType;
                set({ discountType, discountValue: discountType === 'none' ? 0 : form.discountValue });
              }}
            >
              <MenuItem value="none">No Discount</MenuItem>
              <MenuItem value="percentage">Percentage %</MenuItem>
              <MenuItem value="fixed">Fixed ₹</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              type="number"
              label={form.discountType === 'percentage' ? 'Discount %' : 'Discount ₹'}
              value={form.discountValue}
              disabled={form.discountType === 'none'}
              onChange={(e) => set({ discountValue: e.target.value === '' ? 0 : Number(e.target.value) })}
              error={Boolean(errors.discountValue)}
              helperText={errors.discountValue}
              inputProps={{ min: 0, step: '0.01', max: form.discountType === 'percentage' ? 100 : undefined }}
            />
          </Grid>

          <Grid item xs={6} sm={3}>
            <TextField select fullWidth label="Tax Type" value={form.taxType} onChange={(e) => set({ taxType: e.target.value as TaxType })}>
              <MenuItem value="GST">GST</MenuItem>
              <MenuItem value="CGST_SGST">CGST + SGST</MenuItem>
              <MenuItem value="IGST">IGST</MenuItem>
              <MenuItem value="NONE">No Tax</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              select
              fullWidth
              label="Tax Rate"
              value={form.taxRate}
              disabled={form.taxType === 'NONE'}
              onChange={(e) => set({ taxRate: Number(e.target.value) })}
              error={Boolean(errors.taxRate)}
              helperText={errors.taxRate}
            >
              {TAX_RATES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}%
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.subtle' }}>
          <Typography variant="caption" color="text.muted" sx={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Calculation Preview
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 1.5, mt: 1 }}>
            {[
              ['Subtotal', preview.subtotal],
              ['Discount', -preview.discountAmount],
              ['Taxable', preview.taxableAmount],
              ['Tax', preview.taxAmount],
              ['Total', preview.total],
            ].map(([label, value]) => (
              <Box key={String(label)}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {formatMoney(Number(value), CURRENCY)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {showErrors && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="error.main" fontWeight={700}>
              Fix the following to save this item:
            </Typography>
            {Object.values(errors).map((message) => (
              <FieldError key={message} error={`• ${message}`} />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={showErrors}>
          {initial ? 'Save Changes' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
