import { useState, type ReactNode } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { APPROVAL_STATUS_COLORS, buildDocumentJobCard, computeLineItem, type JobCardFormState } from '../../utils/jobCard';
import JobCardDocumentsMenu from './JobCardDocumentsMenu';
import type { JobCardStepActions } from '../../pages/JobCardForm/stepProps';

export function ApprovalStatus({ approval }: { approval: Pick<JobCardFormState['approval'], 'status' | 'method' | 'respondedAt'> }) {
  const customer = approval.method === 'Link' && Boolean(approval.respondedAt);
  const label = approval.status === 'approved' ? `Approved ${customer ? 'by Customer' : '(internal)'}` : approval.status === 'changes_requested' ? `Rejected ${customer ? 'by Customer' : '(internal)'}` : approval.status === 'skipped' ? 'Approval skipped' : approval.status === 'awaiting' ? 'Sent · Pending Approval' : 'Pending Approval';
  return <Stack spacing={1} role="status"><Chip sx={{ alignSelf: 'flex-start', fontWeight: 700 }} color={APPROVAL_STATUS_COLORS[approval.status] || 'default'} label={label} />{customer && <Typography variant="caption">Customer action via approval link · {formatDateTime(approval.respondedAt)}</Typography>}</Stack>;
}

export function ReviewHeader({ form, actions }: { form: JobCardFormState; actions?: JobCardStepActions }) {
  return <Card><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}><Box><Typography variant="overline">Job Card · {actions?.reference || 'Unsaved draft'}</Typography>{actions?.createdAt && <Typography variant="body2">{formatDateTime(actions.createdAt)}</Typography>}<Typography variant="h6">{form.customer.name || 'Customer not entered'}</Typography><Typography variant="body2">{form.customer.phone}</Typography><Typography color="text.secondary">{[form.vehicle.registrationNumber, form.vehicle.brand, form.vehicle.model].filter(Boolean).join(' · ')}</Typography></Box><ApprovalStatus approval={form.approval} /></Stack></CardContent></Card>;
}

export function PricingSummary({ totals, payments = false }: { totals: { subtotal: number; tax: number; discount: number; lineDiscount: number; grandTotal: number; advanceDeducted: number; balanceDue: number }; payments?: boolean }) {
  const rows: [string, number][] = [['Subtotal', totals.subtotal], ['Tax', totals.tax], ['Discount', -(totals.lineDiscount + totals.discount)], ['Grand Total', totals.grandTotal]];
  if (payments) rows.push(['Advance Paid', totals.advanceDeducted], ['Balance Due', totals.balanceDue]);
  return <Box component="dl" sx={{ m: 0 }}>{rows.map(([label, amount]) => <Stack key={label} direction="row" justifyContent="space-between" gap={2} py={0.75}><Typography component="dt" fontWeight={label === 'Grand Total' || label === 'Balance Due' ? 800 : 400}>{label}</Typography><Typography component="dd" sx={{ m: 0 }} fontWeight={700}>{formatCurrency(amount)}</Typography></Stack>)}</Box>;
}

export function ServiceReview({ form, actions, cardsOnly = false }: { form: JobCardFormState; actions?: (index: number) => ReactNode; cardsOnly?: boolean }) {
  return <><Stack spacing={1.5} sx={{ display: cardsOnly ? 'flex' : { xs: 'flex', md: 'none' } }}>{form.lineItems.map((line, i) => <Box key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}><Typography fontWeight={700}>{line.name}</Typography>{line.description && <Box component="details"><Typography component="summary">Description</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{line.description}</Typography></Box>}<Stack direction="row" justifyContent="space-between" gap={1} mt={1}><Typography>{line.qty} {line.unit} × {formatCurrency(line.price)}</Typography><Typography fontWeight={700}>{formatCurrency(computeLineItem(line).total)}</Typography></Stack>{actions?.(i)}</Box>)}</Stack>{!cardsOnly && <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{['Service Name', 'Description', 'Qty', 'Rate', 'Amount', ...(actions ? ['Actions'] : [])].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{form.lineItems.map((line, i) => <TableRow key={i}><TableCell>{line.name}</TableCell><TableCell sx={{ maxWidth: 280, overflowWrap: 'anywhere' }}>{line.description || '—'}</TableCell><TableCell>{line.qty} {line.unit}</TableCell><TableCell>{formatCurrency(line.price)}</TableCell><TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatCurrency(computeLineItem(line).total)}</TableCell>{actions && <TableCell>{actions(i)}</TableCell>}</TableRow>)}</TableBody></Table></Box>}{!form.lineItems.length && <Typography>No services added yet.</Typography>}<Typography variant="caption" color="text.secondary">Approval applies to the complete service list.</Typography></>;
}

export function ApprovalHistory({ approval }: { approval: JobCardFormState['approval'] }) {
  return <Accordion><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={700}>Approval history</Typography></AccordionSummary><AccordionDetails><Stack component="ol" spacing={2} sx={{ pl: 2 }}>{approval.history?.map((entry, i) => <Box component="li" key={i}><Typography fontWeight={600}>{entry.action}</Typography><Typography variant="body2">{[entry.by, entry.at && formatDateTime(entry.at), entry.channel].filter(Boolean).join(' · ')}</Typography>{entry.note && <Typography variant="body2">{entry.note}</Typography>}</Box>)}</Stack>{!approval.history?.length && <Typography>No approval events recorded yet.</Typography>}</AccordionDetails></Accordion>;
}

export function ReviewActions({ form, actions, children }: { form: JobCardFormState; actions?: JobCardStepActions; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [notice, setNotice] = useState('');
  const phone = form.customer.phone.replace(/\D/g, '');
  const internationalPhone = phone.length === 10 ? `91${phone}` : phone;
  const share = async () => {
    setBusy(true); setNotice(''); setLink('');
    try {
      if (form.approval.status === 'approved' || form.approval.status === 'changes_requested') {
        if (!form.approval.token) { setNotice('No customer tracking link is available for this decision.'); return; }
        setLink(new URL('/approval/' + form.approval.token, window.location.origin).href);
        setNotice('Share the existing tracking link. The recorded decision is preserved.');
        return;
      }
      const result = await actions?.share({ channels: ['WhatsApp'] });
      if (!result?.link) { setNotice('Unable to generate the link. Please retry.'); return; }
      if (result.delivery?.some(item => item.channel.toLowerCase() === 'whatsapp' && item.delivered)) setNotice(`Sent via WhatsApp to ${form.customer.phone}`);
      else { setLink(result.link); setNotice('Link ready. Open WhatsApp below, then tap Send to deliver the message.'); }
    } catch { setNotice('Unable to share. Please retry.'); } finally { setBusy(false); }
  };
  return <Box sx={{ '@media print': { display: 'none' } }}><Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={1} role="group" aria-label="Job card actions">{children}<Button variant="outlined" startIcon={<WhatsAppIcon />} disabled={busy || actions?.saving || !actions || !form.lineItems.length || internationalPhone.length < 11} onClick={share}>{busy ? 'Preparing…' : 'Share via WhatsApp'}</Button><JobCardDocumentsMenu label="Print / Download PDF" jobCard={buildDocumentJobCard(form, { reference: actions?.reference, createdAt: actions?.createdAt, createdBy: actions?.currentUser })} /></Stack><Typography variant="caption">WhatsApp recipient: {form.customer.phone || 'Add the customer mobile number to this job card'}</Typography>{notice && <Alert severity="info" sx={{ mt: 1 }}>{notice}</Alert>}{link && <Button component="a" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${internationalPhone}?text=${encodeURIComponent(`${actions?.businessName || 'Your workshop'} · Job ${actions?.reference || 'service request'}\nPlease review your services and track your job: ${link}`)}`}>Open WhatsApp to {form.customer.phone}</Button>}</Box>;
}
