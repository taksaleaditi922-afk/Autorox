import { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  FormLabel, Grid, IconButton, InputAdornment, Radio, RadioGroup, Stack,
  TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import PaymentProofUpload, { type UploadedProof } from './PaymentProofUpload';
import { formatCurrency, formatDate } from '../../utils/format';

export type AdvancePaymentContext = 'job-card' | 'counter-sale' | 'order-summary' | 'estimate';
export type AdvancePaymentValues = {
  amount: string; date: string; paymentMethod: string; remarks: string; proofs: UploadedProof[];
};
export type ExistingAdvance = { id?: string; amount: number; date?: string; paymentMethod?: string; remarks?: string };

const currentDate = () => new Date().toISOString().slice(0, 10);
const EMPTY: AdvancePaymentValues = { amount: '', date: currentDate(), paymentMethod: '', remarks: '', proofs: [] };

export default function AdvancePaymentModal({ isOpen, onSave, onClose, context, existingAdvances = [], maxAmount, busy = false }: {
  isOpen: boolean; onSave: (values: AdvancePaymentValues) => void | Promise<void>; onClose: () => void;
  context: AdvancePaymentContext; existingAdvances?: ExistingAdvance[]; maxAmount?: number; busy?: boolean;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [draft, setDraft] = useState<AdvancePaymentValues>(EMPTY);
  const amount = Number(draft.amount);
  const overLimit = Number.isFinite(maxAmount) && amount > Number(maxAmount);
  const valid = Number.isFinite(amount) && amount > 0 && Boolean(draft.date) && Boolean(draft.paymentMethod) && !overLimit;

  useEffect(() => { if (isOpen) setDraft({ ...EMPTY, date: currentDate(), proofs: [] }); }, [isOpen, context]);

  return <Dialog open={isOpen} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby="advance-payment-title">
    <DialogTitle id="advance-payment-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, fontWeight: 700 }}>
      Advance Payment Management
      <IconButton onClick={onClose} disabled={busy} aria-label="Close advance payment modal"><CloseIcon /></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ pb: 3 }}>
      {!!existingAdvances.length && <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="subtitle2">Existing advance payments ({existingAdvances.length})</Typography></AccordionSummary>
        <AccordionDetails><Stack spacing={1} divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>{existingAdvances.map((entry, index) =>
          <Stack key={entry.id || index} direction="row" justifyContent="space-between" gap={2} py={0.75}>
            <Box><Typography variant="body2" fontWeight={600}>{entry.paymentMethod || 'Payment'}</Typography><Typography variant="caption" color="text.secondary">{entry.date ? formatDate(entry.date) : 'Date unavailable'}{entry.remarks ? ` · ${entry.remarks}` : ''}</Typography></Box>
            <Typography variant="body2" fontWeight={700}>{formatCurrency(entry.amount)}</Typography>
          </Stack>
        )}</Stack></AccordionDetails>
      </Accordion>}

      <Stack direction="row" alignItems="center" gap={0.5} mb={2}><AddIcon fontSize="small" /><Typography variant="subtitle2" sx={{ textTransform: 'uppercase' }}>Add Advance Payment</Typography></Stack>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}><TextField autoFocus fullWidth required type="number" label="Amount Received" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} inputProps={{ min: 0, step: '0.01' }} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} error={overLimit} helperText={overLimit ? `Cannot exceed ${formatCurrency(Number(maxAmount))}` : maxAmount !== undefined ? `Available balance: ${formatCurrency(maxAmount)}` : ' '} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth required type="date" label="Advance Date" InputLabelProps={{ shrink: true }} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} inputProps={{ max: currentDate() }} helperText=" " /></Grid>
        <Grid item xs={12}><FormControl required fullWidth><FormLabel>Choose Payment Method</FormLabel><RadioGroup row value={draft.paymentMethod} onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value }))} sx={{ flexWrap: 'wrap' }}>{['Cash', 'UPI', 'Net Banking', 'Credit/Debit', 'Cheque'].map((method) => <FormControlLabel key={method} value={method} control={<Radio size="small" />} label={<Typography variant="body2">{method}</Typography>} />)}</RadioGroup></FormControl></Grid>
        <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Remarks / Note" placeholder="Write any note for this payment (e.g. advance for spare parts)" value={draft.remarks} onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))} /></Grid>
        <Grid item xs={12}><Typography variant="subtitle2" mb={1}>Upload Payment Proof</Typography><PaymentProofUpload files={draft.proofs} onChange={(proofs) => setDraft((current) => ({ ...current, proofs }))} multiple={false} disabled={busy} /></Grid>
      </Grid>
      {overLimit && <Alert severity="warning" sx={{ mt: 2 }}>The advance cannot exceed the available balance.</Alert>}
    </DialogContent>
    <DialogActions sx={{ position: 'sticky', bottom: 0, px: 3, py: 2, justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
      <Button variant="outlined" color="inherit" onClick={onClose} disabled={busy}>Close</Button>
      <Button variant="contained" onClick={() => void onSave(draft)} disabled={!valid || busy}>{busy ? 'Saving…' : 'Save Advance Payment'}</Button>
    </DialogActions>
  </Dialog>;
}
