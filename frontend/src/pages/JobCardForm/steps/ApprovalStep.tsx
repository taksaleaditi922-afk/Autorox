import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShareIcon from '@mui/icons-material/Share';
import { computeLineItem, LINE_UNITS, LINE_TAX_TYPES, type JobCardLineItem } from '../../../utils/jobCard';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import type { JobCardStepProps } from '../stepProps';

export default function ApprovalStep({ form, set, actions }: JobCardStepProps) {
  const [sharing, setSharing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [link, setLink] = useState('');
  const [notice, setNotice] = useState('');
  const locked = form.approval.status === 'approved';
  const phoneDigits = form.customer.phone.replace(/\D/g, '');
  const localPhone = phoneDigits.replace(/^91(?=\d{10}$)/, '');
  const validPhone = /^[6-9]\d{9}$/.test(localPhone);
  const internationalPhone = validPhone ? `91${localPhone}` : '';
  const update = (index: number, patch: Partial<JobCardLineItem>) => set({ lineItems: form.lineItems.map((line, i) => i === index ? { ...line, ...patch, updatedBy: actions?.currentUser, updatedAt: new Date().toISOString() } : line) });
  const share = async () => {
    setShareOpen(true);
    if (!validPhone) {
      setNotice('Enter a valid 10-digit customer mobile number to continue.');
      return;
    }
    setSharing(true); setNotice(''); setLink('');
    try {
      const result = await actions?.share({ channels: ['WhatsApp'] });
      if (!result?.link) { setNotice('Could not share the service list. Please retry.'); return; }
      setLink(result.link);
      setNotice(result.delivery?.some(item => item.channel === 'WhatsApp' && item.delivered) ? 'Sent to ' + form.customer.phone : 'Open WhatsApp and tap Send to share with ' + form.customer.phone);
    } catch { setNotice('Could not share the service list. Please retry.'); }
    finally { setSharing(false); }
  };
  const openShare = () => {
    setShareOpen(true); setNotice(''); setLink('');
    if (validPhone) void share();
    else setNotice('Enter a valid 10-digit customer mobile number to continue.');
  };
  const whatsapp = 'https://wa.me/' + internationalPhone + '?text=' + encodeURIComponent((actions?.businessName || 'Your workshop') + ' - Job ' + (actions?.reference || '') + '\nPlease review your services: ' + link);
  return <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, p: 1, minHeight: 300, boxShadow: 1 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ px: 1.5, py: 0.5, mb: 1 }}>
      <Typography variant="h6" fontWeight={700} color="primary">Service List for Approval</Typography>
      <Stack direction="row" gap={1}><Button variant="contained" startIcon={<ShareIcon />} disabled={sharing || !actions || !form.lineItems.length} onClick={openShare} sx={{ bgcolor: '#00B42A', backgroundImage: 'none', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#009a24' } }}>{sharing ? 'Preparing…' : 'Share to Customer'}</Button><Button variant="contained" onClick={actions?.skip} disabled={!actions || actions.saving} sx={{ borderRadius: 1 }}>Skip &amp; Next</Button></Stack>
    </Stack>
    {!validPhone && <Alert severity="warning" sx={{ mx: 1.5, mb: 1 }}>Customer mobile number is missing or invalid. Select Share to Customer to add it.</Alert>}
    {form.approval.respondedAt && <Typography variant="caption" sx={{ px: 1.5 }} role="status">{form.approval.status === 'approved' ? 'Approved' : 'Rejected'} by Customer on {formatDateTime(form.approval.respondedAt)}</Typography>}
    <Accordion defaultExpanded disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, px: 1.25, '& .MuiAccordionSummary-content': { my: 0.5 } }}><Typography variant="h6" fontWeight={700}>Service Info</Typography></AccordionSummary>
      <AccordionDetails sx={{ p: 1, pt: 0 }}><TableContainer sx={{ overflowX: 'auto', maxHeight: '48vh' }}><Table size="small" stickyHeader sx={{ minWidth: 1160, '& th': { bgcolor: 'background.default', fontWeight: 500, py: 2 }, '& td': { px: 0.5, py: 0.75 }, '& .MuiInputBase-root': { borderRadius: 0.75, height: 40 } }}>
        <TableHead><TableRow>{['Service Name', 'HSN/SAC', 'Rate/Unit', 'Quantity', 'Tax Type', 'Tax', 'Discount', 'Total', 'Action'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{form.lineItems.map((line, index) => {
          const calc = computeLineItem(line);
          const numberField = (field: string, value: number, patch: (n: number) => Partial<JobCardLineItem>, width: number, prefix?: string) => <TextField size="small" type="number" value={value} disabled={locked} onChange={e => update(index, patch(Number(e.target.value)))} inputProps={{ min: 0, 'aria-label': field + ' for ' + line.name }} InputProps={prefix ? { startAdornment: <InputAdornment position="start">{prefix}</InputAdornment> } : undefined} sx={{ width }} />;
          return <TableRow key={index}><TableCell sx={{ minWidth: 130 }}>{line.name}</TableCell><TableCell><TextField size="small" value={line.hsnSacCode || ''} disabled={locked} onChange={e => update(index, { hsnSacCode: e.target.value })} inputProps={{ 'aria-label': 'HSN/SAC for ' + line.name }} sx={{ width: 88 }} /></TableCell>
            <TableCell><Stack direction="row">{numberField('Rate', line.price, n => ({ price: n }), 100, '\u20b9')}<TextField select size="small" value={line.unit || 'nos'} disabled={locked} onChange={e => update(index, { unit: e.target.value })} inputProps={{ 'aria-label': 'Unit for ' + line.name }} sx={{ width: 95 }}>{LINE_UNITS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}</TextField></Stack></TableCell>
            <TableCell>{numberField('Quantity', line.qty, n => ({ qty: n }), 76)}</TableCell><TableCell><TextField select size="small" value={line.taxType || 'None'} disabled={locked} onChange={e => update(index, { taxType: e.target.value })} inputProps={{ 'aria-label': 'Tax type for ' + line.name }} sx={{ width: 120 }}>{LINE_TAX_TYPES.map(tax => <MenuItem key={tax} value={tax}>{tax}</MenuItem>)}</TextField></TableCell>
            <TableCell><Stack direction="row">{numberField('Tax percent', line.taxRate || 0, n => ({ taxRate: n }), 85, '%')}<TextField size="small" value={formatCurrency(calc.taxAmount)} InputProps={{ readOnly: true }} inputProps={{ 'aria-label': 'Tax amount for ' + line.name }} sx={{ width: 86 }} /></Stack></TableCell>
            <TableCell><Stack direction="row">{numberField('Discount percent', line.discountType === 'percent' ? line.discountValue || 0 : 0, n => ({ discountType: 'percent', discountValue: n }), 85, '%')}{numberField('Discount amount', line.discountType === 'flat' ? line.discountValue || 0 : calc.discountAmount, n => ({ discountType: 'flat', discountValue: n }), 90, '\u20b9')}</Stack></TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(calc.total)}</TableCell><TableCell><TextField select size="small" value="none" disabled={locked} onChange={e => { if (e.target.value === 'remove') set({ lineItems: form.lineItems.filter((_, i) => i !== index) }); }} inputProps={{ 'aria-label': 'Action for ' + line.name }} sx={{ width: 95 }}><MenuItem value="none">None</MenuItem><MenuItem value="remove">Remove</MenuItem></TextField></TableCell></TableRow>;
        })}{!form.lineItems.length && <TableRow><TableCell colSpan={9}>No services added.</TableCell></TableRow>}</TableBody>
      </Table></TableContainer></AccordionDetails>
    </Accordion>
    <Dialog open={shareOpen} onClose={() => !sharing && setShareOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Share to Customer</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus={!validPhone}
          fullWidth
          required
          label="Customer Mobile Number"
          value={form.customer.phone}
          onChange={(event) => {
            set({ customer: { ...form.customer, phone: event.target.value } });
            setNotice('');
            setLink('');
          }}
          error={Boolean(form.customer.phone) && !validPhone}
          helperText={validPhone ? `WhatsApp recipient: +91 ${localPhone}` : 'Enter a valid 10-digit Indian mobile number'}
          inputProps={{ inputMode: 'tel', maxLength: 14 }}
          sx={{ mt: 1, mb: 2 }}
        />
        {sharing && <Typography>Preparing approval link...</Typography>}
        {!sharing && notice && <Alert severity={link ? 'info' : 'warning'}>{notice}</Alert>}
        {link && <Button component="a" href={whatsapp} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<ShareIcon />} sx={{ mt: 2 }}>Open WhatsApp</Button>}
      </DialogContent>
      <DialogActions>
        <Button disabled={sharing} onClick={() => setShareOpen(false)}>Close</Button>
        {!link && <Button variant="contained" disabled={sharing || !validPhone} onClick={share}>Generate &amp; Share</Button>}
      </DialogActions>
    </Dialog>
  </Box>;
}
