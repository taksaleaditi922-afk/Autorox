import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import AdvancePaymentModal from './AdvancePaymentModal';
import JobCardDocumentsMenu from './JobCardDocumentsMenu';
import { buildDocumentJobCard, computeOrderSummary, type JobCardFormState } from '../../utils/jobCard';
import { formatCurrency } from '../../utils/format';
import { calculatePayableTotal } from './PaymentAndDiscountSection';
import { invoiceFromJobCardForm, openInvoicePrint } from '../../services/invoicePrintService';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/uiSlice';

export default function ReviewFooter({ form, set, summary, busy, back, save, next, user, reference, createdAt, nextLabel = 'Save & Next', context = 'job-card' }: {
  form: JobCardFormState; set: (patch: Partial<JobCardFormState>) => void; summary: boolean;
  busy: boolean; back: () => void; save: () => void; next: () => void; user: string;
  reference?: string; createdAt?: string;
  nextLabel?: string;
  context?: 'job-card' | 'counter-sale';
}) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const totals = computeOrderSummary(form);
  const payableTotal = calculatePayableTotal(totals.grandTotal, form.orderSummary);
  const printInvoice = () => {
    try {
      openInvoicePrint(invoiceFromJobCardForm(form, { reference, date: createdAt, grandTotal: payableTotal }));
    } catch (error) {
      dispatch(showToast({ severity: 'error', message: error instanceof Error ? error.message : 'Could not open the invoice' }));
    }
  };
  if (summary) return <>
    <Paper elevation={3} sx={{ position: 'sticky', bottom: 0, zIndex: 5, mt: 0, mx: -1, px: { xs: 1.5, md: 2 }, py: 1.25, borderRadius: 0, '@media print': { display: 'none' } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1.25}>
        <Typography variant="h6" fontWeight={800} sx={{ mr: 'auto' }}>Grand Total: {formatCurrency(payableTotal)}</Typography>
        <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={1}>
          <Button size="small" variant="outlined" startIcon={<QrCode2OutlinedIcon />} onClick={() => setQrOpen(true)}>Show Payment QR</Button>
          <IconButton size="small" aria-label="Print invoice" onClick={printInvoice} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}><PrintOutlinedIcon /></IconButton>
          <Button size="small" variant="contained" disabled={busy} onClick={save}>Save</Button>
          <Button size="small" variant="outlined" color="inherit" onClick={back}>Back</Button>
          <Button size="small" variant="contained" disabled={busy} onClick={next}>{nextLabel === 'Save & Next' ? 'Create Invoice' : nextLabel}</Button>
        </Stack>
      </Stack>
    </Paper>
    <Dialog open={qrOpen} onClose={() => setQrOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Payment QR</DialogTitle>
      <DialogContent><Stack alignItems="center" gap={1.5} py={2}><QrCode2OutlinedIcon sx={{ fontSize: 120 }} /><Typography variant="body2" color="text.secondary">QR payment integration placeholder</Typography><Typography variant="h6" fontWeight={800}>{formatCurrency(payableTotal)}</Typography></Stack></DialogContent>
      <DialogActions><Button onClick={() => setQrOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
  return <><Paper elevation={3} sx={{ position: 'sticky', bottom: 0, zIndex: 5, mt: 0, mx: -1, px: { xs: 1, md: 1.5 }, py: 1, borderRadius: 0, '@media print': { display: 'none' } }}>
    <Stack direction="row" alignItems="center" flexWrap={{ xs: 'wrap', md: 'nowrap' }} gap={1}>
      <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)} disabled={totals.balanceDue <= 0} sx={{ bgcolor: '#FFE14D', backgroundImage: 'none', color: '#4a3b00', borderRadius: 0.5, whiteSpace: 'nowrap', flexShrink: 0, minHeight: 32, '&:hover': { bgcolor: '#f5d63c' } }}>Add Advance</Button>
      <Stack direction="row" alignItems="center" flexWrap={{ xs: 'wrap', sm: 'nowrap' }} gap={0.75} sx={{ ml: 'auto', justifyContent: 'flex-end', minWidth: 0 }}>
        {!summary && <Typography variant="body2" fontWeight={700} color="primary" sx={{ mr: { sm: 1 }, whiteSpace: 'nowrap' }}>Grand Total: {formatCurrency(totals.grandTotal)}</Typography>}
        <JobCardDocumentsMenu iconOnly jobCard={buildDocumentJobCard(form, { reference, createdAt, createdBy: user })} />
        <Button size="small" variant="outlined" color="inherit" onClick={back} sx={{ minWidth: 68, minHeight: 32, borderRadius: 0.75 }}>Back</Button>
        <Button size="small" variant="contained" disabled={busy} onClick={save} sx={{ minWidth: 68, minHeight: 32, borderRadius: 0.75 }}>Save</Button>
        <Button size="small" variant="contained" disabled={busy} onClick={next} sx={{ minWidth: 100, minHeight: 32, whiteSpace: 'nowrap', borderRadius: 0.75 }}>{nextLabel}</Button>
      </Stack>
    </Stack>
  </Paper><AdvancePaymentModal isOpen={open} context={context} existingAdvances={form.advances.map((entry, index) => ({ id: String(index), amount: entry.amount, date: entry.recordedAt, paymentMethod: entry.paymentMode, remarks: entry.reference }))} maxAmount={totals.balanceDue} onClose={() => setOpen(false)} onSave={values => {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > totals.balanceDue) return;
    set({ advances: [...form.advances, { amount, paymentMode: values.paymentMethod, reference: values.remarks, recordedAt: new Date(values.date).toISOString(), recordedBy: user }] });
    setOpen(false);
  }} /></>;
}
