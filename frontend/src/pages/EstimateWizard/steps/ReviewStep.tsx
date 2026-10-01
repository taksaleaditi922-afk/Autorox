// ---------------------------------------------------------------------------
// STEP 4 — Estimate Report / Finalisation.
//
// Aggregates all three previous steps, validates before generation, records
// advance payments, and offers the PDF / WhatsApp / SMS / email / print actions.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SmsIcon from '@mui/icons-material/Sms';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { showToast } from '../../../redux/uiSlice';
import {
  addLocalAdvance,
  removePayment,
  selectEstimate,
  selectEstimateConfig,
} from '../../../redux/estimateSlice';
import { INSPECTION_STATUS_META } from '../../../services/estimate/config';
import * as inspectionService from '../../../services/estimate/inspectionService';
import * as paymentService from '../../../services/estimate/paymentService';
import * as pdfService from '../../../services/estimate/pdfService';
import * as notificationService from '../../../services/estimate/notificationService';
import { formatCurrency, formatDate } from '../../../utils/format';
import { maxAllowedAdvance } from '../../../utils/estimateMath';
import { lineItemTypeLabel, maskIdentityNumber, maskPhone, type StepValidationResult } from '../../../utils/estimateValidation';
import type { AdvancePayment } from '../../../services/estimate/types';
import EstimateTotals from '../../../components/estimate/EstimateTotals';
import { ConfirmDialog, SectionCard, StatusChip, SummaryGrid, SummaryRow } from '../../../components/estimate/primitives';
import AdvancePaymentModal, { type AdvancePaymentValues } from '../../../components/jobCard/AdvancePaymentModal';

export interface ReviewStepProps {
  validation: StepValidationResult;
  onGenerate: () => void;
  generating: boolean;
  generated: boolean;
}

export default function ReviewStep({ validation, onGenerate, generating, generated }: ReviewStepProps) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const estimate = useSelector(selectEstimate);
  const config = useSelector(selectEstimateConfig);

  const [issueOpen, setIssueOpen] = useState<ReturnType<typeof inspectionService.summarise>['issues'][number] | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<AdvancePayment | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);

  const summary = useMemo(() => inspectionService.summarise(estimate.inspection || []), [estimate.inspection]);
  const currency = config.currency || 'INR';
  const cap = maxAllowedAdvance(estimate.totals.grandTotal, config);

  const canGenerate = validation.valid && estimate.lineItems.length > 0;

  // --------------------------------------------------------------- payments
  const submitAdvance = async (values: AdvancePaymentValues) => {
    const draft = {
      amount: Number(values.amount),
      mode: values.paymentMethod as any,
      date: values.date,
      reference: '',
      notes: values.remarks,
    };
    const check = paymentService.validateAdvance(draft, estimate.totals, config, estimate.payments);
    if (!check.ok) {
      dispatch(showToast({ severity: 'error', message: check.error || 'Invalid advance payment' }));
      return;
    }

    dispatch(addLocalAdvance(draft));
    setAdvanceOpen(false);
    if (estimate.draftId) {
      try {
        await paymentService.addAdvance(estimate.draftId, draft);
      } catch (err: any) {
        dispatch(
          showToast({
            severity: 'warning',
            message: err?.response?.data?.error || 'Saved locally — the server is unreachable.',
          })
        );
      }
    }

    dispatch(showToast({ severity: 'success', message: 'Advance payment recorded' }));
  };

  const confirmRemoveAdvance = () => {
    if (!pendingRemove) return;
    if (estimate.draftId && !pendingRemove.id.startsWith('pay-')) {
      void paymentService.removeAdvance(estimate.draftId, pendingRemove.id).catch(() => undefined);
    }
    dispatch(removePayment(pendingRemove.id));
    setPendingRemove(null);
    dispatch(showToast({ severity: 'info', message: 'Advance payment removed' }));
  };

  // ---------------------------------------------------------------- sharing
  const handleShare = async (channel: 'whatsapp' | 'sms' | 'email' | 'copy-link') => {
    setSharing(channel);
    const result = await notificationService.share(channel, estimate, config, { estimateId: estimate.draftId });
    setSharing(null);
    dispatch(showToast({ severity: result.ok ? 'success' : 'error', message: result.message }));
    if (result.ok && ['whatsapp', 'sms', 'email'].includes(channel)) {
      void notificationService.markAsSent(estimate.draftId, channel);
    }
  };

  const handlePrint = () => {
    try {
      pdfService.openPrintWindow(estimate, config, { autoPrint: true });
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.message || 'Could not open the print preview' }));
    }
  };

  const handleDownload = () => {
    try {
      const filename = pdfService.downloadHtml(estimate, config);
      dispatch(showToast({ severity: 'success', message: `${filename} saved` }));
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.message || 'Could not download the estimate' }));
    }
  };

  return (
    <Box>
      {/* ------------------------- validation summary ------------------------- */}
      {!validation.valid && (
        <Alert severity="error" icon={false} sx={{ mb: 2.5 }} role="alert">
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
            Cannot generate estimate
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Please fix the following:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {validation.summary.map((message, index) => (
              <li key={`${message}-${index}`}>
                <Typography variant="body2">⚠ {message}</Typography>
              </li>
            ))}
            {Object.entries(validation.errors).map(([path, message]) => (
              <li key={path}>
                <Typography variant="body2">⚠ {message}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {generated && (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={800}>
            Estimate Generated Successfully
          </Typography>
          <Typography variant="body2">
            Estimate No: <strong>{estimate.metadata.estimateNumber || '—'}</strong> · Status: {estimate.status}
          </Typography>
        </Alert>
      )}

      {/* ------------------------------ header ------------------------------- */}
      <SectionCard title={config.company.name} subtitle="Service Estimate">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {config.company.address}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {config.company.phone} · {config.company.email}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              GSTIN: {config.company.gstNumber}
            </Typography>
          </Box>
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography variant="h6" fontWeight={800}>
              {estimate.metadata.estimateNumber || 'Number assigned on save'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Date: {formatDate(estimate.metadata.estimateDate)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Valid until: {formatDate(estimate.metadata.validUntil)}
            </Typography>
            <StatusChip label={estimate.status} color={estimate.status === 'Generated' ? 'info' : 'default'} />
          </Box>
        </Box>
      </SectionCard>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          {/* ---------------------------- customer ---------------------------- */}
          <SectionCard title="Customer Summary">
            <SummaryGrid
              columns={{ xs: 2, sm: 2 }}
              items={[
                { label: 'Customer', value: estimate.customer.name || '—' },
                { label: 'Phone', value: estimate.customer.phone ? maskPhone(estimate.customer.phone) : '—' },
                { label: 'Email', value: estimate.customer.email || '—' },
                { label: 'GSTIN', value: estimate.customer.gstNumber || '—' },
                {
                  label: 'Address',
                  value:
                    [estimate.customer.address, estimate.customer.city, estimate.customer.state, estimate.customer.pincode]
                      .filter(Boolean)
                      .join(', ') || '—',
                },
                {
                  label: 'Identity Proof',
                  value: estimate.identityProof.idType
                    ? `${estimate.identityProof.idType} · ${maskIdentityNumber(estimate.identityProof.idNumber)}`
                    : '—',
                },
              ]}
            />
            {estimate.pickup.enabled && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.muted" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Pickup Request
                </Typography>
                <SummaryGrid
                  columns={{ xs: 2, sm: 2 }}
                  items={[
                    { label: 'Address', value: estimate.pickup.address },
                    { label: 'Contact', value: `${estimate.pickup.contactPerson} · ${estimate.pickup.phone}` },
                    { label: 'Date', value: formatDate(estimate.pickup.preferredDate) },
                    { label: 'Time', value: estimate.pickup.preferredTime || '—' },
                  ]}
                />
              </>
            )}
          </SectionCard>

          {/* ----------------------------- vehicle ---------------------------- */}
          <SectionCard title="Vehicle Summary">
            <SummaryGrid
              columns={{ xs: 2, sm: 3 }}
              items={[
                {
                  label: 'Vehicle',
                  value: [estimate.vehicle.brand, estimate.vehicle.model, estimate.vehicle.variant].filter(Boolean).join(' ') || '—',
                },
                { label: 'Registration', value: estimate.vehicle.registrationNumber || '—' },
                { label: 'Fuel', value: estimate.vehicle.fuelType || '—' },
                {
                  label: 'Odometer',
                  value: estimate.vehicle.odometer ? `${Number(estimate.vehicle.odometer).toLocaleString('en-IN')} km` : '—',
                },
                { label: 'Year', value: estimate.vehicle.year || '—' },
                { label: 'Colour', value: estimate.vehicle.color || '—' },
                { label: 'Complaint', value: estimate.complaint || '—' },
              ]}
            />
          </SectionCard>

          {/* ---------------------------- inspection -------------------------- */}
          <SectionCard
            title="Inspection Summary"
            subtitle={`${summary.inspected} of ${summary.total} points inspected`}
            action={
              summary.issues.length ? (
                <Chip color="warning" label={`${summary.issues.length} findings`} />
              ) : (
                <Chip color="success" variant="outlined" label="No findings" />
              )
            }
          >
            <Grid container spacing={1.5} sx={{ mb: summary.issues.length ? 2 : 0 }}>
              {(['good', 'attention', 'critical', 'na'] as const).map((status) => (
                <Grid item xs={6} sm={3} key={status}>
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: `${INSPECTION_STATUS_META[status].hex}0f`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      <span aria-hidden="true">{INSPECTION_STATUS_META[status].icon}</span> {INSPECTION_STATUS_META[status].label}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {summary[status]}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {summary.issues.length > 0 && (
              <Stack spacing={0.75}>
                {summary.issues.map((issue) => (
                  <Box
                    key={issue.itemId}
                    component="button"
                    type="button"
                    onClick={() => setIssueOpen(issue)}
                    sx={{
                      textAlign: 'left',
                      width: '100%',
                      p: 1.25,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      font: 'inherit',
                      '&:hover': { borderColor: 'primary.main' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                    }}
                    aria-label={`View details for ${issue.itemName}`}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <StatusChip
                        label={INSPECTION_STATUS_META[issue.status].label}
                        color={INSPECTION_STATUS_META[issue.status].color as any}
                      />
                      <Typography variant="body2" fontWeight={700}>
                        {issue.itemName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {issue.categoryName}
                      </Typography>
                      {issue.mediaCount > 0 && <Chip size="small" variant="outlined" label={`${issue.mediaCount} media`} />}
                      {issue.linkedServiceIds.length > 0 && (
                        <Chip size="small" color="success" variant="outlined" label="Quoted" />
                      )}
                    </Box>
                    {issue.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {issue.notes}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>

          {/* ------------------------------ items ---------------------------- */}
          <SectionCard
            title="Services, Parts & Labour"
            subtitle={`${estimate.lineItems.length} item${estimate.lineItems.length === 1 ? '' : 's'}`}
          >
            <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Tax</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {estimate.lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {item.name}
                        </Typography>
                        {item.inspectionItemName && (
                          <Typography variant="caption" color="info.main">
                            Recommended from inspection: {item.inspectionItemName}
                          </Typography>
                        )}
                        {item.type === 'package' && item.packageContents?.length ? (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Includes {item.packageContents.map((c) => c.name).join(', ')}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>{lineItemTypeLabel(item.type)}</TableCell>
                      <TableCell align="right">
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(item.rate, currency)}</TableCell>
                      <TableCell align="right">{item.discountAmount ? formatCurrency(item.discountAmount, currency) : '—'}</TableCell>
                      <TableCell align="right">{item.taxType === 'NONE' ? '—' : `${item.taxRate}%`}</TableCell>
                      <TableCell align="right">{formatCurrency(item.total, currency)}</TableCell>
                    </TableRow>
                  ))}
                  {!estimate.lineItems.length && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No items yet — go back to Step 3 to build the estimate.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {isMobile && (
              <Stack spacing={1}>
                {estimate.lineItems.map((item) => (
                  <Box key={item.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {item.name}
                      </Typography>
                      <Typography variant="body2" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.total, currency)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {lineItemTypeLabel(item.type)} · {item.quantity} {item.unit} × {formatCurrency(item.rate, currency)}
                      {item.taxType !== 'NONE' ? ` · ${item.taxRate}% tax` : ''}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        {/* ---------------------------- right column --------------------------- */}
        <Grid item xs={12} md={5}>
          <Box sx={{ mb: 2.5 }}>
            <EstimateTotals totals={estimate.totals} config={config} itemCount={estimate.lineItems.length} />
          </Box>

          {/* --------------------------- advances --------------------------- */}
          <SectionCard
            title="Advance / Deposit"
            subtitle={
              Number.isFinite(cap)
                ? `Maximum allowed: ${formatCurrency(cap, currency)}`
                : 'Overpayment allowed by configuration'
            }
            action={
              <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={() => setAdvanceOpen(true)}>
                Add Advance
              </Button>
            }
          >
            {estimate.payments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No advance payment recorded yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {estimate.payments.map((payment) => (
                  <Box
                    key={payment.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {formatCurrency(payment.amount, currency)} · {payment.mode}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(payment.date)}
                        {payment.reference ? ` · Ref ${payment.reference}` : ''}
                      </Typography>
                    </Box>
                    <Tooltip title="Remove advance">
                      <IconButton size="small" onClick={() => setPendingRemove(payment)} aria-label="Remove advance payment">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ))}
              </Stack>
            )}
            <Divider sx={{ my: 1.5 }} />
            <SummaryRow label="Grand Total" value={formatCurrency(estimate.totals.grandTotal, currency)} />
            <SummaryRow label="Advance Paid" value={`-${formatCurrency(estimate.totals.advancePaid, currency)}`} />
            <SummaryRow label="Balance Due" value={formatCurrency(estimate.totals.balanceDue, currency)} emphasize />
          </SectionCard>

          {/* ------------------------- generate + actions ------------------------- */}
          <SectionCard title="Generate & Share">
            {!generated ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {canGenerate
                    ? 'Everything checks out. Generate the estimate to lock the numbers and issue the estimate number.'
                    : 'Resolve the validation problems above to enable generation.'}
                </Typography>
                <Button fullWidth variant="contained" size="large" onClick={onGenerate} disabled={!canGenerate || generating}>
                  {generating ? 'Generating…' : 'Generate Estimate'}
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Estimate {estimate.metadata.estimateNumber} is ready to send.
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handlePrint}>
                      Preview PDF
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload}>
                      Download
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<WhatsAppIcon />}
                      disabled={sharing === 'whatsapp'}
                      onClick={() => handleShare('whatsapp')}
                    >
                      WhatsApp
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<SmsIcon />} disabled={sharing === 'sms'} onClick={() => handleShare('sms')}>
                      SMS
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="outlined" startIcon={<EmailIcon />} disabled={sharing === 'email'} onClick={() => handleShare('email')}>
                      Email
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<LinkIcon />}
                      disabled={sharing === 'copy-link'}
                      onClick={() => handleShare('copy-link')}
                    >
                      Copy Link
                    </Button>
                  </Grid>
                  <Grid item xs={12}>
                    <Button fullWidth variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
                      Print
                    </Button>
                  </Grid>
                </Grid>
              </>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {/* ------------------------- inspection issue detail ------------------------ */}
      <Dialog open={Boolean(issueOpen)} onClose={() => setIssueOpen(null)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>
          {issueOpen?.itemName}
          <Typography variant="body2" color="text.secondary">
            {issueOpen?.categoryName}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {issueOpen && (
            <>
              <StatusChip
                label={INSPECTION_STATUS_META[issueOpen.status].label}
                color={INSPECTION_STATUS_META[issueOpen.status].color as any}
              />
              <Typography variant="caption" color="text.muted" sx={{ display: 'block', mt: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                Notes
              </Typography>
              <Typography variant="body2">{issueOpen.notes || 'No notes recorded.'}</Typography>

              <Typography variant="caption" color="text.muted" sx={{ display: 'block', mt: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                Photos & Videos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {issueOpen.mediaCount
                  ? `${issueOpen.mediaCount} attachment${issueOpen.mediaCount === 1 ? '' : 's'} captured during inspection.`
                  : 'No media captured.'}
              </Typography>

              <Typography variant="caption" color="text.muted" sx={{ display: 'block', mt: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                Linked Service
              </Typography>
              {issueOpen.linkedServiceIds.length ? (
                <Stack spacing={0.5}>
                  {issueOpen.linkedServiceIds.map((id) => {
                    const item = estimate.lineItems.find((i) => i.id === id);
                    return (
                      <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ImageOutlinedIcon fontSize="small" color="info" />
                        <Typography variant="body2">
                          {item ? `${item.name} — ${formatCurrency(item.total, currency)}` : 'Removed from the estimate'}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No service was quoted for this finding.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <AdvancePaymentModal
        isOpen={advanceOpen}
        context="estimate"
        existingAdvances={estimate.payments.map((payment) => ({ id: payment.id, amount: payment.amount, date: payment.date, paymentMethod: payment.mode, remarks: payment.notes }))}
        maxAmount={Number.isFinite(cap) ? cap : undefined}
        onClose={() => setAdvanceOpen(false)}
        onSave={submitAdvance}
      />

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Remove this advance payment?"
        message={
          pendingRemove
            ? `${formatCurrency(pendingRemove.amount, currency)} recorded on ${formatDate(pendingRemove.date)} will be removed and the balance recalculated.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={confirmRemoveAdvance}
        onClose={() => setPendingRemove(null)}
      />
    </Box>
  );
}
