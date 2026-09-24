// ---------------------------------------------------------------------------
// Line item editor.
//
// The table on Step 3 / Step 4 keeps the name, quantity and rate inline; the
// compliance and pricing detail (HSN/SAC, unit, tax type, discount) lives here so
// the row itself stays readable at any width.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  LINE_DISCOUNT_TYPES,
  LINE_TAX_TYPES,
  LINE_UNITS,
  computeLineItem,
  createLineItem,
  resolveDiscountType,
  type JobCardLineItem,
} from '../../utils/jobCard';
import { formatCurrency } from '../../utils/format';

export interface LineItemDialogProps {
  open: boolean;
  /** Index in the service list, or null when adding a new row. */
  index: number | null;
  item: JobCardLineItem | null;
  /** Field errors for this row, keyed by the field name (no `lineItems.N.` prefix). */
  errors?: Record<string, string>;
  onClose: () => void;
  onSave: (index: number | null, item: JobCardLineItem) => void;
}

export default function LineItemDialog({ open, index, item, errors = {}, onClose, onSave }: LineItemDialogProps) {
  const [draft, setDraft] = useState<JobCardLineItem>(() => createLineItem());

  // Reload the draft whenever a different row is opened.
  useEffect(() => {
    if (!open) return;
    setDraft(item ? { ...createLineItem(), ...item } : createLineItem());
  }, [open, item]);

  const calc = useMemo(() => computeLineItem(draft), [draft]);
  const discountType = resolveDiscountType(draft);
  const isPart = draft.type === 'part';
  const stockShort =
    isPart && draft.stockAvailable !== null && draft.stockAvailable !== undefined
      ? Number(draft.qty) > Number(draft.stockAvailable)
      : false;

  const update = (patch: Partial<JobCardLineItem>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>{index === null ? 'Add item' : 'Edit item'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              required
              autoFocus
              label="Item name"
              placeholder="e.g. TYRE"
              value={draft.name}
              error={Boolean(errors.name)}
              helperText={errors.name}
              onChange={(event) => update({ name: event.target.value.toUpperCase() })}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Category"
              value={draft.type}
              onChange={(event) => update({ type: event.target.value })}
            >
              {['service', 'package', 'part', 'labour', 'custom'].map((type) => (
                <MenuItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="HSN / SAC code"
              value={draft.hsnSacCode || ''}
              onChange={(event) => update({ hsnSacCode: event.target.value.toUpperCase() })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              select
              fullWidth
              label="Unit"
              value={draft.unit || 'nos'}
              onChange={(event) => update({ unit: event.target.value })}
            >
              {LINE_UNITS.map((unit) => (
                <MenuItem key={unit} value={unit}>
                  {unit}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              type="number"
              label="Quantity"
              required
              value={draft.qty}
              error={Boolean(errors.qty)}
              helperText={errors.qty}
              inputProps={{ min: 0, step: 'any' }}
              onChange={(event) => update({ qty: Number(event.target.value) })}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Rate per unit (₹)"
              required
              value={draft.price}
              error={Boolean(errors.price)}
              helperText={errors.price}
              inputProps={{ min: 0, step: '0.01' }}
              onChange={(event) => update({ price: Number(event.target.value) })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              select
              fullWidth
              label="Tax type"
              value={draft.taxType || 'None'}
              onChange={(event) => update({ taxType: event.target.value })}
            >
              {LINE_TAX_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              type="number"
              label="Tax %"
              disabled={(draft.taxType || 'None') === 'None'}
              value={draft.taxRate ?? 0}
              error={Boolean(errors.taxRate)}
              helperText={errors.taxRate}
              inputProps={{ min: 0, max: 100, step: '0.5' }}
              onChange={(event) => update({ taxRate: Number(event.target.value) })}
            />
          </Grid>

          <Grid item xs={6} sm={4}>
            <TextField
              select
              fullWidth
              label="Discount on"
              value={discountType}
              onChange={(event) => update({ discountType: event.target.value })}
            >
              {LINE_DISCOUNT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type === 'none' ? 'No discount' : type === 'percent' ? 'Percentage' : 'Flat amount'}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              fullWidth
              type="number"
              label={discountType === 'percent' ? 'Discount %' : 'Discount (₹)'}
              disabled={discountType === 'none'}
              value={draft.discountValue ?? 0}
              error={Boolean(errors.discountValue)}
              helperText={errors.discountValue}
              inputProps={{ min: 0, max: discountType === 'percent' ? 100 : undefined, step: 'any' }}
              onChange={(event) => update({ discountValue: Number(event.target.value) })}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Note / spec"
              placeholder="Warranty, OEM part, etc."
              value={draft.description || ''}
              onChange={(event) => update({ description: event.target.value })}
            />
          </Grid>

          {isPart && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Stock available"
                value={draft.stockAvailable ?? ''}
                onChange={(event) =>
                  update({ stockAvailable: event.target.value === '' ? null : Number(event.target.value) })
                }
                helperText="Captured from inventory when the part was added"
              />
            </Grid>
          )}
        </Grid>

        {stockShort && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Quantity exceeds the {draft.stockAvailable} in stock. You can still add it — the order will be marked for
            procurement.
          </Alert>
        )}

        <Divider sx={{ my: 2.5 }} />

        <Stack spacing={0.75}>
          <Row label="Subtotal (rate × qty)" value={formatCurrency(calc.subtotal)} />
          {calc.discountAmount > 0 && <Row label="Line discount" value={`− ${formatCurrency(calc.discountAmount)}`} />}
          <Row label="Taxable amount" value={formatCurrency(calc.taxableAmount)} />
          <Row label="Tax" value={formatCurrency(calc.taxAmount)} />
          <Row label="Line total" value={formatCurrency(calc.total)} strong />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!draft.name.trim()}
          onClick={() => onSave(index, { ...draft, name: draft.name.trim() })}
        >
          {index === null ? 'Add item' : 'Save item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 700 : 400}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 600}>
        {value}
      </Typography>
    </Box>
  );
}
