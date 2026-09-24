// ---------------------------------------------------------------------------
// STEP 3 — Services, Packages & Parts.
//
// Builds the billable list for the job card. Five entry points (Custom Order,
// Services, Packages, Parts, Labour) open a searchable multi-select catalogue
// drawer; packages expand into their component rows. Everything is priced by the
// shared engine in utils/jobCardPricing, so the running total here is the same
// number Step 4 signs off and the backend stores.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BuildIcon from '@mui/icons-material/Build';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import HandymanIcon from '@mui/icons-material/Handyman';
import SellIcon from '@mui/icons-material/Sell';
import PaymentsIcon from '@mui/icons-material/Payments';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CloseIcon from '@mui/icons-material/Close';
import CatalogPicker, { type CatalogSelection, type CatalogTab } from '../../../components/estimate/CatalogPicker';
import AdvanceDialog, { type AdvanceValues } from '../../../components/jobCard/AdvanceDialog';
import LineItemDialog from '../../../components/jobCard/LineItemDialog';
import {
  DEFAULT_TAX_RATE,
  LINE_TAX_TYPES,
  computeLineItem,
  computeOrderSummary,
  createLineItem,
  discountLabel,
  isStockShort,
  resolveTaxType,
  type JobCardLineItem,
} from '../../../utils/jobCard';
import { serviceListWarnings } from '../../../utils/jobCardValidation';
import { formatCurrency } from '../../../utils/format';
import type { CatalogLabour, CatalogPackage, CatalogPart, CatalogService } from '../../../services/estimate/types';
import type { JobCardStepProps } from '../stepProps';

const CATEGORY_BUTTONS: { tab: CatalogTab; label: string; icon: React.ReactElement; hint: string }[] = [
  { tab: 'custom', label: 'Custom Order', icon: <AddCircleOutlineIcon />, hint: 'A one-off charge that is not in the catalogue' },
  { tab: 'services', label: 'Services', icon: <BuildIcon />, hint: 'Standard labour tasks from the service master' },
  { tab: 'packages', label: 'Packages', icon: <Inventory2Icon />, hint: 'Bundles that expand into their component items' },
  { tab: 'parts', label: 'Parts', icon: <HandymanIcon />, hint: 'Inventory parts, with live stock' },
  { tab: 'labour', label: 'Labour', icon: <SellIcon />, hint: 'Labour-only charges with no inventory link' },
];

// --- catalogue -> line item conversion -------------------------------------

export function serviceLine(service: CatalogService): JobCardLineItem {
  return createLineItem({
    catalogId: service.id,
    name: service.name,
    type: 'service',
    hsnSacCode: service.hsnSacCode || '',
    unit: service.unit || 'nos',
    qty: 1,
    price: service.rate,
    taxType: 'GST',
    taxRate: service.taxRate ?? DEFAULT_TAX_RATE,
  });
}

export function partLine(part: CatalogPart): JobCardLineItem {
  return createLineItem({
    catalogId: part.id,
    name: part.name,
    type: 'part',
    hsnSacCode: part.hsnCode || '',
    partNumber: part.partNumber || '',
    brand: part.brand || '',
    unit: part.unit || 'nos',
    qty: 1,
    price: part.rate,
    taxType: 'GST',
    taxRate: part.taxRate ?? DEFAULT_TAX_RATE,
    stockAvailable: typeof part.stock === 'number' ? part.stock : null,
  });
}

export function labourLine(labour: CatalogLabour): JobCardLineItem {
  return createLineItem({
    catalogId: labour.id,
    name: labour.description,
    type: 'labour',
    hsnSacCode: labour.sacCode || '',
    unit: labour.unit || 'hr',
    qty: 1,
    price: labour.rate,
    taxType: 'GST',
    taxRate: labour.taxRate ?? DEFAULT_TAX_RATE,
  });
}

/**
 * A package becomes a priced header row plus one zero-rated row per component,
 * so the bundle price is charged once while the customer still sees exactly what
 * the package includes.
 */
export function packageLines(pkg: CatalogPackage): JobCardLineItem[] {
  const header = createLineItem({
    catalogId: pkg.id,
    name: pkg.name,
    type: 'package',
    unit: 'job',
    qty: 1,
    price: pkg.price,
    taxType: 'GST',
    taxRate: pkg.taxRate ?? DEFAULT_TAX_RATE,
    packageId: pkg.id,
    packageName: pkg.name,
    isPackageHeader: true,
  });

  const contents = (pkg.contents || []).map((content) =>
    createLineItem({
      name: content.name,
      type: content.type || 'service',
      description: `Included in ${pkg.name}`,
      unit: 'nos',
      qty: content.quantity || 1,
      price: 0,
      taxType: 'None',
      taxRate: 0,
      packageId: pkg.id,
      packageName: pkg.name,
      coreItem: true,
    })
  );

  return [header, ...contents];
}

export default function ServicesPartsStep({ form, errors, set, actions }: JobCardStepProps) {
  const items = form.lineItems;
  const totals = useMemo(() => computeOrderSummary(form), [form]);
  const warnings = useMemo(() => serviceListWarnings(form), [form]);

  const [pickerTab, setPickerTab] = useState<CatalogTab | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceBusy, setAdvanceBusy] = useState(false);

  const stamp = (line: JobCardLineItem): JobCardLineItem => ({
    ...line,
    updatedBy: line.updatedBy || actions?.currentUser || 'You',
    updatedAt: new Date().toISOString(),
  });

  const addLines = (lines: JobCardLineItem[]) => {
    if (!lines.length) return;
    set({ lineItems: [...items, ...lines.map(stamp)] });
  };

  const addFromSelection = (selection: CatalogSelection[]) => {
    const lines: JobCardLineItem[] = [];
    for (const row of selection) {
      if (row.tab === 'services') lines.push(serviceLine(row.item));
      else if (row.tab === 'parts') lines.push(partLine(row.item));
      else if (row.tab === 'labour') lines.push(labourLine(row.item));
      else if (row.tab === 'packages') lines.push(...packageLines(row.item));
    }
    addLines(lines);
    setPickerTab(null);
  };

  const updateItem = (index: number, patch: Partial<JobCardLineItem>) => {
    set({
      lineItems: items.map((line, i) => (i === index ? stamp({ ...line, ...patch }) : line)),
    });
  };

  const removeItem = (index: number) => {
    set({ lineItems: items.filter((_line, i) => i !== index) });
  };

  const openEditor = (index: number | null) => {
    setEditIndex(index);
    setEditOpen(true);
  };

  const saveEditor = (index: number | null, item: JobCardLineItem) => {
    if (index === null) addLines([item]);
    else updateItem(index, item);
    setEditOpen(false);
  };

  const clearList = () => set({ lineItems: [] });

  const handleAdvance = async (values: AdvanceValues) => {
    const amount = Number(values.amount) || 0;
    set({
      advance: { amount: values.amount, paymentMode: values.paymentMode, reference: values.reference },
      intake: { ...form.intake, advanceAmount: values.amount, advancePaymentMode: values.paymentMode },
    });
    setAdvanceOpen(false);

    // Persist against the job card when it already exists on the server.
    if (actions?.persisted) {
      setAdvanceBusy(true);
      await actions.recordAdvance({ amount, paymentMode: values.paymentMode, reference: values.reference });
      setAdvanceBusy(false);
    }
  };

  const rowErrors = (index: number): Record<string, string> => {
    const prefix = `lineItems.${index}.`;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(errors)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
    }
    return out;
  };

  return (
    <Box>
      {/* ------------------------- item entry categories -------------------- */}
      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>
            Add items to the service list
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick a category — each one opens the searchable list for that source. You can select several items at once.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {CATEGORY_BUTTONS.map((category) => (
              <Tooltip key={category.tab} title={category.hint}>
                <Button
                  variant="outlined"
                  startIcon={category.icon}
                  onClick={() => setPickerTab(category.tab)}
                  sx={{ flexGrow: { xs: 1, sm: 0 } }}
                >
                  {category.label}
                </Button>
              </Tooltip>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' } }}>
        {/* ------------------------------- list ----------------------------- */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" fontWeight={700}>
                Service &amp; Parts List
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" variant="outlined" label={`${items.length} item${items.length === 1 ? '' : 's'}`} />
                <Button size="small" variant="outlined" startIcon={<AddCircleOutlineIcon fontSize="small" />} onClick={() => openEditor(null)}>
                  Add Row
                </Button>
                <Tooltip title="Clear the whole list">
                  <span>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteSweepIcon fontSize="small" />}
                      disabled={!items.length}
                      onClick={clearList}
                    >
                      Clear
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>

            {errors['lineItems'] && (
              <Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
                {errors['lineItems']}
              </Typography>
            )}

            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell width={110}>HSN / SAC</TableCell>
                    <TableCell width={110}>Qty</TableCell>
                    <TableCell width={130}>Rate / unit</TableCell>
                    <TableCell width={120}>Tax</TableCell>
                    <TableCell width={110}>Discount</TableCell>
                    <TableCell width={110} align="right">
                      Subtotal
                    </TableCell>
                    <TableCell width={110} align="right">
                      Total
                    </TableCell>
                    <TableCell width={130}>Updated by</TableCell>
                    <TableCell width={80} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((line, index) => {
                    const calc = computeLineItem(line);
                    const taxType = resolveTaxType(line);
                    const short = isStockShort(line);
                    return (
                      <TableRow key={`${line.name}-${index}`} hover>
                        <TableCell>
                          <Stack spacing={0.5} sx={{ minWidth: 220 }}>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder="Item name"
                              value={line.name}
                              error={Boolean(errors[`lineItems.${index}.name`])}
                              helperText={errors[`lineItems.${index}.name`]}
                              onChange={(event) => updateItem(index, { name: event.target.value.toUpperCase() })}
                            />
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                              <Chip size="small" variant="outlined" label={line.type} />
                              {line.packageName && <Chip size="small" color="info" variant="outlined" label={line.packageName} />}
                              {line.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {line.description}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{line.hsnSacCode || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <TextField
                              size="small"
                              type="number"
                              value={line.qty}
                              error={Boolean(errors[`lineItems.${index}.qty`])}
                              onChange={(event) => updateItem(index, { qty: Number(event.target.value) })}
                              inputProps={{ min: 0, step: 'any', style: { width: 52 } }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {line.unit || 'nos'}
                            </Typography>
                          </Stack>
                          {short && (
                            <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                              Only {line.stockAvailable} in stock
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={line.price}
                            error={Boolean(errors[`lineItems.${index}.price`])}
                            onChange={(event) => updateItem(index, { price: Number(event.target.value) })}
                            inputProps={{ min: 0, step: '0.01', style: { width: 80 } }}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography variant="body2">{taxType === 'None' ? 'None' : `${taxType} ${line.taxRate ?? 0}%`}</Typography>
                            {errors[`lineItems.${index}.taxRate`] && (
                              <Typography variant="caption" color="error.main">
                                {errors[`lineItems.${index}.taxRate`]}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{discountLabel(line)}</Typography>
                          {errors[`lineItems.${index}.discountValue`] && (
                            <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                              {errors[`lineItems.${index}.discountValue`]}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{formatCurrency(calc.subtotal)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700}>
                            {formatCurrency(calc.total)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {line.updatedBy || '—'}
                          </Typography>
                          {line.updatedAt && (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(line.updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                            <Tooltip title="Edit item">
                              <IconButton size="small" onClick={() => openEditor(index)} aria-label={`Edit ${line.name}`}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove item">
                              <IconButton size="small" color="error" onClick={() => removeItem(index)} aria-label={`Remove ${line.name}`}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No services added yet. Choose a category above to start building the list.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* ------------------------------ totals ---------------------------- */}
        <Card sx={{ alignSelf: 'start', position: { lg: 'sticky' }, top: { lg: 96 } }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>
              Total Amount
            </Typography>
            <Stack spacing={1}>
              <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
              {totals.lineDiscount > 0 && <Row label="Line discounts" value={`− ${formatCurrency(totals.lineDiscount)}`} />}
              {totals.discount > 0 && <Row label="Order discount" value={`− ${formatCurrency(totals.discount)}`} />}
              <Row label="Tax" value={formatCurrency(totals.tax)} />
              <Divider />
              <Row label="Grand total" value={formatCurrency(totals.grandTotal)} strong />
              {totals.advanceDeducted > 0 && (
                <>
                  <Row label="Advance" value={`− ${formatCurrency(totals.advanceDeducted)}`} />
                  <Row label="Balance due" value={formatCurrency(totals.balanceDue)} strong />
                </>
              )}
            </Stack>

            <Button
              fullWidth
              variant="contained"
              startIcon={<PaymentsIcon />}
              sx={{ mt: 2, bgcolor: '#FFE14D', color: '#4a3b00', '&:hover': { bgcolor: '#f5d63c' } }}
              onClick={() => setAdvanceOpen(true)}
            >
              {totals.advanceDeducted > 0 ? 'Update Advance' : 'Add Advance'}
            </Button>

            {warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Stack spacing={0.5}>
                  {warnings.map((warning) => (
                    <Typography key={warning} variant="caption">
                      {warning}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Quantities and rates are editable inline. Use the edit icon for HSN/SAC, unit, tax type and discount. The
              order discount, Back, Save and Save &amp; Next live in the bar at the bottom of the page.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* --------------------------- catalogue drawer ----------------------- */}
      <Dialog open={Boolean(pickerTab)} onClose={() => setPickerTab(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700} component="span">
              {CATEGORY_BUTTONS.find((category) => category.tab === pickerTab)?.label || 'Catalogue'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Search, tick the items you want, then add them all at once.
            </Typography>
          </Box>
          <IconButton onClick={() => setPickerTab(null)} aria-label="Close the catalogue">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {pickerTab && pickerTab !== 'custom' ? (
            <CatalogPicker
              key={pickerTab}
              vehicleType={form.vehicleType as any}
              defaultTaxRate={DEFAULT_TAX_RATE}
              initialTab={pickerTab}
              multiSelect
              onAddService={(service) => addLines([serviceLine(service)])}
              onAddPackage={(pkg) => addLines(packageLines(pkg))}
              onAddPart={(part) => addLines([partLine(part)])}
              onAddLabour={(labour) => addLines([labourLine(labour)])}
              onAddMany={addFromSelection}
              onAddCustom={() => {
                setPickerTab(null);
                openEditor(null);
              }}
            />
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Add a custom line item
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                For anything not in the catalogue — one-off charges, consumables or sublet work.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => {
                  setPickerTab(null);
                  openEditor(null);
                }}
              >
                Add custom item
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <LineItemDialog
        open={editOpen}
        index={editIndex}
        item={editIndex === null ? null : items[editIndex] || null}
        errors={editIndex === null ? {} : rowErrors(editIndex)}
        onClose={() => setEditOpen(false)}
        onSave={saveEditor}
      />

      <AdvanceDialog
        open={advanceOpen}
        values={{
          amount: form.advance.amount,
          paymentMode: form.advance.paymentMode,
          reference: form.advance.reference,
        }}
        total={totals.grandTotal}
        busy={advanceBusy}
        onClose={() => setAdvanceOpen(false)}
        onSave={handleAdvance}
      />
    </Box>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} fontWeight={strong ? 700 : 400}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 600}>
        {value}
      </Typography>
    </Box>
  );
}
