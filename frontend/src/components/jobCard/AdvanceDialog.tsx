// ---------------------------------------------------------------------------
// Add Advance — records a partial payment / deposit against the service list.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { PAYMENT_MODES } from '../../utils/jobCard';
import { formatCurrency } from '../../utils/format';

export interface AdvanceValues {
  amount: string;
  paymentMode: string;
  reference: string;
}

export interface AdvanceDialogProps {
  open: boolean;
  values: AdvanceValues;
  /** Grand total the advance is being paid against. */
  total: number;
  busy?: boolean;
  onClose: () => void;
  onSave: (values: AdvanceValues) => void;
}

export default function AdvanceDialog({ open, values, total, busy, onClose, onSave }: AdvanceDialogProps) {
  const [draft, setDraft] = useState<AdvanceValues>(values);

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const amount = Number(draft.amount) || 0;
  const overpaid = amount > total;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Add Advance</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Available balance is {formatCurrency(total)}. Any advance recorded here is deducted from the balance due.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              autoFocus
              required
              type="number"
              label="Advance amount (₹)"
              value={draft.amount}
              inputProps={{ min: 0, step: '0.01' }}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label="Payment mode"
              value={draft.paymentMode}
              onChange={(event) => setDraft((current) => ({ ...current, paymentMode: event.target.value }))}
            >
              {PAYMENT_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Reference (optional)"
              value={draft.reference}
              onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Balance after advance
          </Typography>
          <Typography variant="body2" fontWeight={800}>
            {formatCurrency(Math.max(total - amount, 0))}
          </Typography>
        </Box>

        {overpaid && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            The advance cannot exceed the available balance.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave(draft)} disabled={busy || overpaid || amount <= 0 || !Number.isFinite(amount)}>
          {busy ? 'Saving…' : 'Record advance'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
