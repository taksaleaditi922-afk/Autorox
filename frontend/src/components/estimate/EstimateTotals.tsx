// ---------------------------------------------------------------------------
// <EstimateTotals /> — the live financial summary.
//
// Renders exactly what the tax engine produced; nothing here recomputes money.
// ---------------------------------------------------------------------------

import { Box, Divider, Skeleton, Typography } from '@mui/material';
import { formatMoney } from '../../utils/estimateMath';
import type { EstimateBusinessConfig, EstimateTotals as Totals } from '../../services/estimate/types';

export interface EstimateTotalsProps {
  totals: Totals;
  config: EstimateBusinessConfig;
  itemCount?: number;
  loading?: boolean;
  /** Sticky variant used in the desktop right-hand rail. */
  sticky?: boolean;
  title?: string;
}

function Row({
  label,
  value,
  muted,
  negative,
}: {
  label: string;
  value: string;
  muted?: boolean;
  negative?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.45, gap: 2 }}>
      <Typography variant="body2" color={muted ? 'text.muted' : 'text.secondary'} sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ color: negative ? 'success.dark' : 'text.primary', whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function EstimateTotals({
  totals,
  config,
  itemCount,
  loading,
  sticky,
  title = 'Estimate Summary',
}: EstimateTotalsProps) {
  const currency = config?.currency || 'INR';
  const money = (value: number) => formatMoney(value, currency);

  if (loading) {
    return (
      <Box>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} height={24} sx={{ my: 0.4 }} />
        ))}
      </Box>
    );
  }

  const hasIgst = totals.igst > 0;
  const taxRateLabel = totals.taxableAmount > 0 ? Math.round(((totals.cgst + totals.sgst + totals.igst) / totals.taxableAmount) * 1000) / 10 : 0;

  return (
    <Box
      sx={
        sticky
          ? { position: { md: 'sticky' }, top: { md: 80 }, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }
          : undefined
      }
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {typeof itemCount === 'number' && (
          <Typography variant="caption" color="text.muted">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </Typography>
        )}
      </Box>

      <Row label="Subtotal" value={money(totals.subtotal)} />
      {totals.discountTotal > 0 && (
        <Row label="Discount" value={`-${money(totals.discountTotal)}`} negative />
      )}
      <Row label="Taxable Amount" value={money(totals.taxableAmount)} />

      {hasIgst ? (
        <Row label={`IGST${taxRateLabel ? ` (${taxRateLabel}%)` : ''}`} value={money(totals.igst)} />
      ) : (
        <>
          <Row label={`CGST${taxRateLabel ? ` (${taxRateLabel / 2}%)` : ''}`} value={money(totals.cgst)} />
          <Row label={`SGST${taxRateLabel ? ` (${taxRateLabel / 2}%)` : ''}`} value={money(totals.sgst)} />
        </>
      )}

      {totals.roundOff !== 0 && <Row label="Round Off" value={money(totals.roundOff)} muted />}

      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={800}>
          Grand Total
        </Typography>
        <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
          {money(totals.grandTotal)}
        </Typography>
      </Box>

      {totals.advancePaid > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Row label="Advance Paid" value={`-${money(totals.advancePaid)}`} negative />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              p: 1.25,
              mt: 0.5,
              borderRadius: 2,
              bgcolor: totals.balanceDue > 0 ? 'background.subtle' : 'success.light',
            }}
          >
            <Typography variant="subtitle2" fontWeight={800}>
              Balance Due
            </Typography>
            <Typography variant="subtitle1" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
              {money(totals.balanceDue)}
            </Typography>
          </Box>
        </>
      )}

      <Typography variant="caption" color="text.muted" sx={{ display: 'block', mt: 1.5 }}>
        Totals are recalculated by the server when the estimate is generated.
      </Typography>
    </Box>
  );
}
