// ---------------------------------------------------------------------------
// Payment Status Dialog — edit payment status with amount, mode, date.
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
import { PAYMENT_MODES, PAYMENT_STATUSES } from '../../utils/jobCard';
import { formatCurrency } from '../../utils/format';

export interface PaymentStatusValues {
  paymentStatus: string;
  amountPaid: string;
  paymentMode: string;
  paymentDate: string;
  reference: string;
}

export interface PaymentStatusDialogProps {
  open: boolean;
  values: PaymentStatusValues;
  total: number;
  balanceDue: number;
  busy?: boolean;
  onClose: () => void;
  onSave: (values: PaymentStatusValues) => void;
}

export default function PaymentStatusDialog({
  open,
  values,
  total,
  balanceDue,
  busy,
  onClose,
  onSave,
}: PaymentStatusDialogProps) {
  const [draft, setDraft] = useState<PaymentStatusValues>(values);
  const [showAmountFields, setShowAmountFields] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(values);
      setShowAmountFields(['Partially Paid', 'Paid'].includes(values.paymentStatus));
    }
  }, [open, values]);

  const amountPaid = Number(draft.amountPaid) || 0;
  const calculatedBalance = Math.max(total - amountPaid, 0);
  const overpaid = amountPaid > total;
  const isPartiallyPaid = draft.paymentStatus === 'Partially Paid';
  const isPaid = draft.paymentStatus === 'Paid';

  const handleStatusChange = (newStatus: string) => {
    setDraft((prev) => {
      const updated = { ...prev, paymentStatus: newStatus };
      if (['Partially Paid', 'Paid'].includes(newStatus) && !prev.amountPaid) {
        updated.amountPaid = newStatus === 'Paid' ? String(total) : String(balanceDue);
      }
      if (newStatus === 'Pending') {
        updated.amountPaid = '0';
      }
      return updated;
    });
    setShowAmountFields(['Partially Paid', 'Paid'].includes(newStatus));
  };

  const handleAmountChange = (amount: string) => {
    setDraft((prev) => ({ ...prev, amountPaid: amount }));
    const numAmount = Number(amount) || 0;
    if (numAmount >= total) {
      setDraft((prev) => ({ ...prev, paymentStatus: 'Paid' }));
      setShowAmountFields(true);
    } else if (numAmount > 0) {
      setDraft((prev) => ({ ...prev, paymentStatus: 'Partially Paid' }));
      setShowAmountFields(true);
    } else {
      setDraft((prev) => ({ ...prev, paymentStatus: 'Pending' }));
      setShowAmountFields(false);
    }
  };

  const handlePaymentModeChange = (mode: string) => {
    setDraft((prev) => ({ ...prev, paymentMode: mode }));
  };

  const handlePaymentDateChange = (date: string) => {
    setDraft((prev) => ({ ...prev, paymentDate: date }));
  };

  const handleReferenceChange = (ref: string) => {
    setDraft((prev) => ({ ...prev, reference: ref }));
  };

  const isSaveDisabled =
    busy ||
    overpaid ||
    amountPaid < 0 ||
    !Number.isFinite(amountPaid) ||
    (showAmountFields && amountPaid <= 0) ||
    (isPartiallyPaid && amountPaid >= total) ||
    (isPaid && amountPaid < total);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Edit Payment Status</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Total Amount: <strong>{formatCurrency(total)}</strong>{' '}
          | Balance Due: <strong>{formatCurrency(balanceDue)}</strong>
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label="Payment Status"
              value={draft.paymentStatus}
              onChange={(event) => handleStatusChange(event.target.value)}
              required
            >
              {PAYMENT_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {showAmountFields && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Amount Paid (₹)"
                  value={draft.amountPaid}
                  inputProps={{ min: 0, step: '0.01' }}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Payment Mode"
                  value={draft.paymentMode}
                  onChange={(event) => handlePaymentModeChange(event.target.value)}
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
                  type="date"
                  label="Payment Date"
                  value={draft.paymentDate}
                  onChange={(event) => handlePaymentDateChange(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reference (optional)"
                  value={draft.reference}
                  onChange={(event) => handleReferenceChange(event.target.value)}
                />
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Balance After Payment
              </Typography>
              <Typography
                variant="body2"
                fontWeight={800}
                color={overpaid ? 'error.main' : 'text.primary'}
              >
                {formatCurrency(calculatedBalance)}
              </Typography>
            </Box>
          </Grid>

          {overpaid && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              The amount paid cannot exceed the total amount.
            </Alert>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave(draft)} disabled={isSaveDisabled}>
          {busy ? 'Saving…' : 'Save Payment Status'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
