import { useState } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AdvanceDialog from './AdvanceDialog';
import JobCardDocumentsMenu from './JobCardDocumentsMenu';
import { buildDocumentJobCard, computeOrderSummary, type JobCardFormState } from '../../utils/jobCard';
import { formatCurrency } from '../../utils/format';

export default function ReviewFooter({ form, set, summary, busy, back, save, next, user, reference, createdAt }: {
  form: JobCardFormState; set: (patch: Partial<JobCardFormState>) => void; summary: boolean;
  busy: boolean; back: () => void; save: () => void; next: () => void; user: string;
  reference?: string; createdAt?: string;
}) {
  const [open, setOpen] = useState(false);
  const totals = computeOrderSummary(form);
  return <><Paper elevation={3} sx={{ position: 'sticky', bottom: 0, zIndex: 5, mt: 0, mx: -1, px: { xs: 1, md: 1.5 }, py: 1, borderRadius: 0, '@media print': { display: 'none' } }}>
    <Stack direction="row" alignItems="center" flexWrap={{ xs: 'wrap', md: 'nowrap' }} gap={1}>
      <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)} disabled={totals.balanceDue <= 0} sx={{ bgcolor: '#FFE14D', backgroundImage: 'none', color: '#4a3b00', borderRadius: 0.5, whiteSpace: 'nowrap', flexShrink: 0, minHeight: 32, '&:hover': { bgcolor: '#f5d63c' } }}>Add Advance</Button>
      <Stack direction="row" alignItems="center" flexWrap={{ xs: 'wrap', sm: 'nowrap' }} gap={0.75} sx={{ ml: 'auto', justifyContent: 'flex-end', minWidth: 0 }}>
        {!summary && <Typography variant="body2" fontWeight={700} color="primary" sx={{ mr: { sm: 1 }, whiteSpace: 'nowrap' }}>Grand Total: {formatCurrency(totals.grandTotal)}</Typography>}
        <JobCardDocumentsMenu iconOnly jobCard={buildDocumentJobCard(form, { reference, createdAt, createdBy: user })} />
        <Button size="small" variant="outlined" color="inherit" onClick={back} sx={{ minWidth: 68, minHeight: 32, borderRadius: 0.75 }}>Back</Button>
        <Button size="small" variant="contained" disabled={busy} onClick={save} sx={{ minWidth: 68, minHeight: 32, borderRadius: 0.75 }}>Save</Button>
        <Button size="small" variant="contained" disabled={busy} onClick={next} sx={{ minWidth: 100, minHeight: 32, whiteSpace: 'nowrap', borderRadius: 0.75 }}>Save &amp; Next</Button>
      </Stack>
    </Stack>
  </Paper><AdvanceDialog open={open} values={{ amount: '', paymentMode: 'Cash', reference: '' }} total={totals.balanceDue} onClose={() => setOpen(false)} onSave={values => {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > totals.balanceDue) return;
    set({ advances: [...form.advances, { ...values, amount, recordedAt: new Date().toISOString(), recordedBy: user }] });
    setOpen(false);
  }} /></>;
}
