import { useState, type ReactNode } from 'react';
import {
  Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, FormLabel, Grid, Radio,
  RadioGroup, Stack, Switch, TextField, Typography,
} from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import type { JobCardFormState } from '../../utils/jobCard';
import { formatCurrency } from '../../utils/format';
import PaymentProofUpload, { type UploadedProof } from './PaymentProofUpload';

type Summary = JobCardFormState['orderSummary'];

export function calculatePayableTotal(grandTotal: number, summary: Summary): number {
  const coupon = Math.max(0, Number(summary.couponDiscount) || 0);
  const loyalty = summary.loyaltyRedeemed ? Math.max(0, Number(summary.loyaltyDiscount) || 0) : 0;
  return Math.max(0, grandTotal - coupon - loyalty);
}

function ActionRow({ label, icon, onClick }: { label: string; icon?: ReactNode; onClick: () => void }) {
  return <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} py={1.5}>
    <Stack direction="row" alignItems="center" gap={1}>{icon}<Typography variant="body2" fontWeight={600}>{label}</Typography></Stack>
    <Button size="small" onClick={onClick}>Apply</Button>
  </Stack>;
}

export default function PaymentAndDiscountSection({ summary, grandTotal, setSummary, disabled }: {
  summary: Summary; grandTotal: number; setSummary: (patch: Partial<Summary>) => void; disabled?: boolean;
}) {
  const [placeholder, setPlaceholder] = useState<'coupon' | 'discount' | null>(null);
  const [proofs, setProofs] = useState<UploadedProof[]>([]);
  const payableTotal = calculatePayableTotal(grandTotal, summary);
  const toggleLoyalty = (enabled: boolean) => setSummary({ loyaltyRedeemed: enabled, loyaltyDiscount: enabled ? String(Math.min(500, Math.round(grandTotal * 0.05))) : '' });

  return <>
    <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
      <Grid item xs={12} md={5}>
        <Card sx={{ height: '100%' }}><CardContent>
          <Typography variant="h6" mb={1}>Discounts &amp; Loyalty</Typography>
          <ActionRow label="🎟 Coupons" onClick={() => setPlaceholder('coupon')} />
          <Divider />
          <ActionRow label="Additional Discount" icon={<LocalOfferOutlinedIcon color="action" />} onClick={() => setPlaceholder('discount')} />
          <Divider />
          <FormControlLabel sx={{ m: 0, py: 1, width: '100%', justifyContent: 'space-between' }} labelPlacement="start" label={<Box><Typography variant="body2" fontWeight={600}>Redeem Loyalty Points</Typography>{summary.loyaltyRedeemed && <Typography variant="caption" color="text.secondary">Saving {formatCurrency(Number(summary.loyaltyDiscount) || 0)}</Typography>}</Box>} control={<Switch checked={summary.loyaltyRedeemed} onChange={(event) => toggleLoyalty(event.target.checked)} disabled={disabled} />} />
        </CardContent></Card>
      </Grid>
      <Grid item xs={12} md={7}>
        <Card sx={{ height: '100%' }}><CardContent>
          <FormControl fullWidth disabled={disabled}>
            <FormLabel sx={{ typography: 'h6', color: 'text.primary', mb: 1 }}>Choose Payment Method</FormLabel>
            <RadioGroup row value={summary.paymentMethod || 'None'} onChange={(event) => setSummary({ paymentMethod: event.target.value })} sx={{ gap: { xs: 0, sm: 1 }, flexWrap: 'wrap' }}>
              {['None', 'Cash', 'UPI', 'Net Banking', 'Credit/Debit', 'Cheque'].map((method) => <FormControlLabel key={method} value={method} control={<Radio size="small" />} label={<Typography variant="body2">{method}</Typography>} />)}
            </RadioGroup>
          </FormControl>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.25}>
            <Button variant="contained" onClick={() => setSummary({ paymentType: 'Spot Pay' })} disabled={disabled}>Spot Pay</Button>
            <Button variant="outlined" onClick={() => setSummary({ paymentType: 'Credit Pay' })} disabled={disabled}>Credit Pay</Button>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, mx: 0.5 }} />
            <TextField size="small" label="Total" value={formatCurrency(payableTotal)} InputProps={{ readOnly: true }} sx={{ ml: { sm: 'auto' }, maxWidth: { sm: 210 } }} />
          </Stack>
          {summary.paymentType && <Typography variant="caption" color="text.secondary" display="block" mt={1}>Selected: {summary.paymentType}</Typography>}
        </CardContent></Card>
      </Grid>
      <Grid item xs={12}>
        <Card><CardContent><Grid container spacing={2.5}>
          <Grid item xs={12} md={5}><Typography variant="subtitle2" mb={1}>Add Remarks</Typography><TextField fullWidth multiline minRows={5} placeholder="Add Remarks" value={summary.remarks} onChange={(event) => setSummary({ remarks: event.target.value })} disabled={disabled} /></Grid>
          <Grid item xs={12} md={7}><Typography variant="subtitle2" mb={1}>Upload Payment Proofs</Typography><PaymentProofUpload files={proofs} onChange={setProofs} disabled={disabled} prompt="Browse or drag files to upload" /></Grid>
        </Grid></CardContent></Card>
      </Grid>
    </Grid>
    <Dialog open={placeholder !== null} onClose={() => setPlaceholder(null)} fullWidth maxWidth="xs">
      <DialogTitle>{placeholder === 'coupon' ? 'Coupon Selection' : 'Additional Discount'}</DialogTitle>
      <DialogContent><Typography variant="body2" color="text.secondary">This selection screen is ready to be connected in a future update.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setPlaceholder(null)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
