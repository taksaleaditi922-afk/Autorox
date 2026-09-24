// ---------------------------------------------------------------------------
// STEP 5 — Order Summary.
//
// The final commercial review of the job card: the billable service list plus
// the money breakdown (subtotal, line discounts, order discount, tax, grand
// total, advances and balance due) and the payment terms. Previously this step
// only repeated the service table, so the order-level discount and payment
// terms the rest of the system expects could never be entered.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import GroupsIcon from '@mui/icons-material/Groups';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PaymentsIcon from '@mui/icons-material/Payments';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Collapse, Dialog, DialogContent, DialogTitle, Divider, Grid, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import StaffPicker from '../../../components/jobCard/StaffPicker';
import LineItemDialog from '../../../components/jobCard/LineItemDialog';
import CatalogPicker from '../../../components/estimate/CatalogPicker';
import { serviceLine, partLine, labourLine, packageLines } from './ServicesPartsStep';
import { computeLineItem, computeOrderSummary, createLineItem, type JobCardLineItem } from '../../../utils/jobCard';
import { estimatedDeliveryWarning } from '../../../utils/jobCardValidation';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format';
import type { JobCardStepProps } from '../stepProps';

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={2} py={0.75}>
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 700 : 400}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 600}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function OrderSummaryStep({ form, errors, set, setSection, actions }: JobCardStepProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [staffTarget, setStaffTarget] = useState<number | 'supervisor' | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editor, setEditor] = useState<{ index: number | null; item: JobCardLineItem } | null>(null);

  const totals = useMemo(() => computeOrderSummary(form), [form]);
  const deliveryWarning = useMemo(() => estimatedDeliveryWarning(form), [form]);
  const advancePaid = totals.advanceDeducted;
  const paymentStatus = totals.total > 0 && totals.balanceDue <= 0 ? 'Paid' : 'Pending';
  const locked = form.approval.status === 'approved';
  const errorMessages = Array.from(new Set(Object.values(errors).filter(Boolean)));

  const update = (index: number, patch: Partial<JobCardLineItem>) =>
    set({ lineItems: form.lineItems.map((line, i) => (i === index ? { ...line, ...patch, updatedBy: actions?.currentUser, updatedAt: new Date().toISOString() } : line)) });
  const add = (lines: JobCardLineItem[]) => {
    set({ lineItems: [...form.lineItems, ...lines] });
    setCatalogOpen(false);
  };

  return (
    <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 1, p: { xs: 1.5, md: 2.5 }, minHeight: 340 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} mb={2} alignItems="stretch">
        <Card sx={{ flex: 1, borderRadius: 1, boxShadow: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2.5, py: 1.25 }}>
            <Avatar sx={{ bgcolor: 'warning.light', color: 'warning.dark', width: 54, height: 54 }}>
              <GroupsIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Customer Details</Typography>
              <Typography color="text.secondary">{form.customer.name || '--'}</Typography>
            </Box>
          </Stack>
        </Card>
        <Card sx={{ flex: 1, borderRadius: 1, boxShadow: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2.5, py: 1.25 }}>
            <Avatar sx={{ bgcolor: 'warning.light', color: 'warning.dark', width: 54, height: 54 }}>
              <DirectionsCarIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Vehicle Details</Typography>
              <Typography color="text.secondary">{[form.vehicle.brand, form.vehicle.model].filter(Boolean).join(' ') || '--'}</Typography>
            </Box>
          </Stack>
        </Card>
        <IconButton
          aria-label="Show customer and vehicle details"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen(!detailsOpen)}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, width: 62, flexShrink: 0 }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Stack>
      <Collapse in={detailsOpen}>
        <Typography mb={2}>
          {form.customer.phone} / {form.vehicle.registrationNumber}
        </Typography>
      </Collapse>

      {form.approval.respondedAt && (
        <Typography variant="caption" role="status">
          {form.approval.status === 'approved' ? 'Approved' : 'Rejected'} by Customer on {formatDateTime(form.approval.respondedAt)}
        </Typography>
      )}

      {errorMessages.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessages.join(' / ')}
        </Alert>
      )}

      {/* ------------------------------- order summary ------------------------ */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 1, boxShadow: 2, height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Typography variant="h6" fontWeight={700}>Order Summary</Typography>
                <Chip
                  size="small"
                  color={paymentStatus === 'Paid' ? 'success' : 'warning'}
                  label={paymentStatus}
                />
              </Stack>
              <SummaryLine label="Subtotal" value={formatCurrency(totals.subtotal)} />
              <SummaryLine label="Line Discounts" value={`- ${formatCurrency(totals.lineDiscount)}`} />
              <SummaryLine label="Order Discount" value={`- ${formatCurrency(totals.discount)}`} />
              <SummaryLine label="Taxable Amount" value={formatCurrency(totals.subtotal - totals.lineDiscount - totals.discount)} />
              <SummaryLine label="Tax" value={formatCurrency(totals.tax)} />
              <Divider sx={{ my: 1 }} />
              <SummaryLine label="Grand Total" value={formatCurrency(totals.grandTotal)} strong />
              <SummaryLine label="Advance Paid" value={`- ${formatCurrency(advancePaid)}`} />
              <SummaryLine label="Balance Due" value={formatCurrency(totals.balanceDue)} strong />
              <Divider sx={{ my: 1.5 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Order Discount"
                    value={form.orderSummary.discount}
                    disabled={locked}
                    onChange={(e) => setSection('orderSummary', { discount: e.target.value })}
                    inputProps={{ min: 0, step: '0.01', 'aria-label': 'Order discount' }}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>₹</Typography> }}
                    error={Boolean(errors['orderSummary.discount'])}
                    helperText={errors['orderSummary.discount'] || 'Applied after line discounts'}
                  />
                </Grid>
                <Grid item xs={12} sm={7}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Payment Terms"
                    placeholder="e.g. 50% advance, balance on delivery"
                    value={form.orderSummary.paymentTerms}
                    disabled={locked}
                    onChange={(e) => setSection('orderSummary', { paymentTerms: e.target.value })}
                    inputProps={{ maxLength: 160, 'aria-label': 'Payment terms' }}
                    helperText="Printed on the invoice"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 1, boxShadow: 2, height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                <PaymentsIcon fontSize="small" color="primary" />
                <Typography variant="h6" fontWeight={700}>Advances</Typography>
              </Stack>
              {form.advances.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No advance recorded yet. Use “Add Advance” in the footer to record a deposit.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={1}>
                  {form.advances.map((entry, index) => (
                    <Stack key={`${entry.recordedAt}-${index}`} direction="row" alignItems="center" gap={1}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(entry.amount)} · {entry.paymentMode}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(entry.recordedAt)}
                          {entry.reference ? ` · Ref ${entry.reference}` : ''}
                          {entry.recordedBy ? ` · ${entry.recordedBy}` : ''}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        aria-label={`Remove advance ${index + 1}`}
                        disabled={locked}
                        onClick={() => set({ advances: form.advances.filter((_, i) => i !== index) })}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Divider sx={{ my: 1.5 }} />
              <SummaryLine label="Total Advance Paid" value={formatCurrency(advancePaid)} />
              <SummaryLine label="Balance Due" value={formatCurrency(totals.balanceDue)} strong />

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Delivery &amp; Ownership</Typography>
              <SummaryLine
                label="Estimated Delivery"
                value={form.estimatedDelivery.date ? `${formatDate(form.estimatedDelivery.date)}${form.estimatedDelivery.time ? ` · ${form.estimatedDelivery.time}` : ''}` : 'Not set'}
              />
              <SummaryLine label="Supervisor" value={form.supervisor?.name || 'Unassigned'} />
              <SummaryLine label="Service Advisor" value={actions?.currentUser || '—'} />
              {deliveryWarning && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  {deliveryWarning} This will not stop you from saving.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ------------------------------ service list -------------------------- */}
      <Card sx={{ borderRadius: 1, boxShadow: 2 }}>
        <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={2} mb={3}>
            <Typography variant="h6" fontWeight={700}>Order Items</Typography>
            <Stack direction="row" gap={2} flexWrap="wrap">
              <Button variant="outlined" onClick={() => setStaffTarget('supervisor')} sx={{ minHeight: 52 }}>+ Assign Supervisor</Button>
              <Button variant="outlined" disabled={locked} onClick={() => setEditor({ index: null, item: createLineItem({ type: 'labour', unit: 'hr' }) })} sx={{ minHeight: 52 }}>+ Add Labour Charge</Button>
              <Button variant="outlined" disabled={locked} onClick={() => setCatalogOpen(true)} sx={{ minHeight: 52 }}>+ Add More</Button>
            </Stack>
          </Stack>
          <TableContainer sx={{ overflowX: 'auto', maxHeight: '48vh' }}>
            <Table size="small" sx={{ minWidth: 1100, '& th': { fontWeight: 700, bgcolor: 'background.paper' }, '& td': { py: 1.5 } }}>
              <TableHead>
                <TableRow>
                  {['Type', 'Name', 'Details', 'Unit', 'Price/Unit', 'Qty', 'Tax', 'Discount', 'Total', 'Mechanic', ''].map((label, i) => (
                    <TableCell key={i}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {form.lineItems.map((line, index) => {
                  const calc = computeLineItem(line);
                  return (
                    <TableRow key={index}>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{line.type}</TableCell>
                      <TableCell>
                        {line.name}
                        <IconButton size="small" aria-label={'Edit ' + line.name} disabled={locked} onClick={() => setEditor({ index, item: line })}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell>{line.description || '--'}</TableCell>
                      <TableCell>{line.unit || 'N/A'}</TableCell>
                      <TableCell>{formatCurrency(line.price)}</TableCell>
                      <TableCell>{line.qty}</TableCell>
                      <TableCell>{line.taxType === 'None' ? 0 : line.taxRate || 0}% ({formatCurrency(calc.taxAmount)})</TableCell>
                      <TableCell>{line.discountType === 'percent' ? (line.discountValue || 0) + '%' : ''} ({formatCurrency(calc.discountAmount)})</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(calc.total)}</TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" onClick={() => setStaffTarget(index)} sx={{ px: 1, borderRadius: 0.75 }}>
                          {line.assignedMechanic?.name || 'Assign'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" aria-label={'Remove ' + line.name} disabled={locked} onClick={() => set({ lineItems: form.lineItems.filter((_, i) => i !== index) })}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!form.lineItems.length && (
                  <TableRow>
                    <TableCell colSpan={11}>No services added.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <StaffPicker
        open={staffTarget !== null}
        title={staffTarget === 'supervisor' ? 'Assign Supervisor' : 'Assign Mechanic'}
        role={staffTarget === 'supervisor' ? 'supervisor' : 'mechanic'}
        selected={staffTarget === 'supervisor' ? form.supervisor : typeof staffTarget === 'number' ? form.lineItems[staffTarget]?.assignedMechanic : null}
        onClose={() => setStaffTarget(null)}
        onSelect={(staff) => {
          const assignment = { staffId: staff.staffId, name: staff.name, assignedAt: new Date().toISOString() };
          if (staffTarget === 'supervisor') set({ supervisor: assignment });
          else if (typeof staffTarget === 'number') update(staffTarget, { assignedMechanic: assignment });
        }}
      />
      <LineItemDialog
        open={Boolean(editor)}
        index={editor?.index ?? null}
        item={editor?.item || null}
        onClose={() => setEditor(null)}
        onSave={(index, item) => {
          if (index === null) add([item]);
          else update(index, item);
          setEditor(null);
        }}
      />
      <Dialog open={catalogOpen} onClose={() => setCatalogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          Add More Items
          <Button sx={{ float: 'right' }} onClick={() => setCatalogOpen(false)}>Close</Button>
        </DialogTitle>
        <DialogContent dividers>
          <CatalogPicker
            vehicleType={form.vehicleType === '2W' ? '2W' : '4W'}
            multiSelect
            onAddService={(item) => add([serviceLine(item)])}
            onAddPart={(item) => add([partLine(item)])}
            onAddLabour={(item) => add([labourLine(item)])}
            onAddPackage={(item) => add(packageLines(item))}
            onAddCustom={() => {
              setCatalogOpen(false);
              setEditor({ index: null, item: createLineItem() });
            }}
            onAddMany={(selections) =>
              add(selections.flatMap(({ tab, item }) => (tab === 'packages' ? packageLines(item) : [tab === 'parts' ? partLine(item) : tab === 'labour' ? labourLine(item) : serviceLine(item)])))
            }
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
