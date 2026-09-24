// ---------------------------------------------------------------------------
// <LineItemTable /> — the editable estimate line item table.
//
// Desktop: a professional table with inline quantity / rate / discount editing.
// Mobile: each row becomes an expandable card with the same fields, so the
// estimate stays editable on a phone without horizontal scrolling.
// ---------------------------------------------------------------------------

import { Fragment, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  IconButton,
  MenuItem,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { formatCurrency } from '../../utils/format';
import { lineItemTypeLabel } from '../../utils/estimateValidation';
import type { DiscountType, EstimateLineItem } from '../../services/estimate/types';
import { EmptyState, StatusChip } from './primitives';

const TYPE_COLORS: Record<EstimateLineItem['type'], 'default' | 'info' | 'warning' | 'success' | 'secondary'> = {
  service: 'info',
  package: 'secondary',
  part: 'warning',
  labour: 'success',
  custom: 'default',
};

export interface LineItemTableProps {
  items: EstimateLineItem[];
  onInlineChange: (id: string, patch: Partial<EstimateLineItem>) => void;
  onEdit: (item: EstimateLineItem) => void;
  onDuplicate: (id: string) => void;
  onDelete: (item: EstimateLineItem) => void;
  onAddItem: () => void;
  emptyAction?: React.ReactNode;
}

function TaxLabel({ item }: { item: EstimateLineItem }) {
  if (item.taxType === 'NONE' || !item.taxRate) return <Typography variant="body2" color="text.muted">No Tax</Typography>;
  const label = item.taxType === 'GST' ? 'GST' : item.taxType === 'CGST_SGST' ? 'C+S' : item.taxType;
  return (
    <Typography variant="body2">
      {item.taxRate}% {label}
    </Typography>
  );
}

function DiscountInput({ item, onChange }: { item: EstimateLineItem; onChange: (patch: Partial<EstimateLineItem>) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', minWidth: 132 }}>
      <TextField
        select
        size="small"
        value={item.discountType}
        onChange={(e) => {
          const discountType = e.target.value as DiscountType;
          onChange({ discountType, discountValue: discountType === 'none' ? 0 : item.discountValue });
        }}
        sx={{ width: 62 }}
        inputProps={{ 'aria-label': `Discount type for ${item.name}` }}
      >
        <MenuItem value="none">—</MenuItem>
        <MenuItem value="percentage">%</MenuItem>
        <MenuItem value="fixed">₹</MenuItem>
      </TextField>
      <TextField
        size="small"
        type="number"
        value={item.discountValue}
        disabled={item.discountType === 'none'}
        onChange={(e) => onChange({ discountValue: e.target.value === '' ? 0 : Number(e.target.value) })}
        sx={{ width: 66 }}
        inputProps={{ min: 0, step: '0.01', 'aria-label': `Discount value for ${item.name}` }}
      />
    </Box>
  );
}

function RowActions({
  item,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  item: EstimateLineItem;
  onEdit: (item: EstimateLineItem) => void;
  onDuplicate: (id: string) => void;
  onDelete: (item: EstimateLineItem) => void;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Tooltip title="Edit item">
        <IconButton size="small" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Duplicate item">
        <IconButton size="small" onClick={() => onDuplicate(item.id)} aria-label={`Duplicate ${item.name}`}>
          <ContentCopyOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete item">
        <IconButton size="small" color="error" onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function LineItemTable({
  items,
  onInlineChange,
  onEdit,
  onDuplicate,
  onDelete,
  onAddItem,
  emptyAction,
}: LineItemTableProps) {
  const [expanded, setExpanded] = useState<string | false>(false);

  if (!items.length) {
    return (
      <EmptyState
        title="No services added yet"
        description="Add services, packages, parts, or labour to build the estimate."
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* ---------------------------- desktop ---------------------------- */}
      <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" aria-label="Estimate line items">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right" sx={{ width: 92 }}>
                Qty
              </TableCell>
              <TableCell>Unit</TableCell>
              <TableCell align="right" sx={{ width: 116 }}>
                Rate
              </TableCell>
              <TableCell sx={{ width: 150 }}>Discount</TableCell>
              <TableCell align="right">Tax</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right" sx={{ width: 130 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <Fragment key={item.id}>
                <TableRow hover>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {item.name}
                      </Typography>
                      {item.inspectionItemName && (
                        <Tooltip title={`Recommended from inspection: ${item.inspectionCategoryName} — ${item.inspectionItemName}`}>
                          <LinkOutlinedIcon sx={{ fontSize: 15, color: 'info.main' }} aria-label="Linked to an inspection finding" />
                        </Tooltip>
                      )}
                    </Box>
                    {item.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {item.description}
                      </Typography>
                    )}
                    {(item.hsnSacCode || item.partNumber) && (
                      <Typography variant="caption" color="text.muted">
                        {[item.hsnSacCode && `HSN/SAC ${item.hsnSacCode}`, item.partNumber, item.brand].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                    {item.type === 'package' && item.packageContents?.length ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Includes {item.packageContents.length} items
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusChip label={lineItemTypeLabel(item.type)} color={TYPE_COLORS[item.type]} />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onInlineChange(item.id, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                      sx={{ width: 78 }}
                      inputProps={{ min: 0, step: '0.5', 'aria-label': `Quantity for ${item.name}` }}
                      error={Number(item.quantity) <= 0}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {item.unit}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={item.rate}
                      onChange={(e) => onInlineChange(item.id, { rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                      sx={{ width: 104 }}
                      inputProps={{ min: 0, step: '0.01', 'aria-label': `Rate for ${item.name}` }}
                      error={Number(item.rate) < 0}
                    />
                  </TableCell>
                  <TableCell>
                    <DiscountInput item={item} onChange={(patch) => onInlineChange(item.id, patch)} />
                  </TableCell>
                  <TableCell align="right">
                    <TaxLabel item={item} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(item.total)}
                    </Typography>
                    {item.discountAmount > 0 && (
                      <Typography variant="caption" color="success.dark" sx={{ display: 'block' }}>
                        -{formatCurrency(item.discountAmount)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <RowActions item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
                  </TableCell>
                </TableRow>
                {item.type === 'package' && item.packageContents?.length ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 0.5, bgcolor: 'background.subtle' }}>
                      <Typography variant="caption" color="text.secondary">
                        Package contents: {item.packageContents.map((c) => `${c.name} × ${c.quantity}`).join(' · ')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ----------------------------- mobile ---------------------------- */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {items.map((item) => (
          <Accordion
            key={item.id}
            expanded={expanded === item.id}
            onChange={(_e, isExpanded) => setExpanded(isExpanded ? item.id : false)}
            disableGutters
            sx={{ '&:before': { display: 'none' }, border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', mb: 1, overflow: 'hidden' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1.5 }}>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="body2" fontWeight={700}>
                    {item.name}
                  </Typography>
                  <Chip label={lineItemTypeLabel(item.type)} size="small" color={TYPE_COLORS[item.type]} />
                  {item.inspectionItemName && <Chip label="Inspection" size="small" variant="outlined" color="info" />}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {item.quantity} {item.unit} × {formatCurrency(item.rate)}
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={800} sx={{ mr: 1, whiteSpace: 'nowrap' }}>
                {formatCurrency(item.total)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  size="small"
                  type="number"
                  label="Quantity"
                  value={item.quantity}
                  onChange={(e) => onInlineChange(item.id, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                  inputProps={{ min: 0, step: '0.5' }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Rate"
                  value={item.rate}
                  onChange={(e) => onInlineChange(item.id, { rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                  inputProps={{ min: 0, step: '0.01' }}
                />
                <Box sx={{ gridColumn: 'span 2' }}>
                  <DiscountInput item={item} onChange={(patch) => onInlineChange(item.id, patch)} />
                </Box>
                <Box sx={{ gridColumn: 'span 2' }}>
                  <TaxLabel item={item} />
                  {item.discountAmount > 0 && (
                    <Typography variant="caption" color="success.dark" sx={{ display: 'block' }}>
                      Discount {formatCurrency(item.discountAmount)} · Taxable {formatCurrency(item.taxableAmount)} · Tax{' '}
                      {formatCurrency(item.taxAmount)}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
                <Box>
                  <IconButton size="small" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onDuplicate(item.id)} aria-label={`Duplicate ${item.name}`}>
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
                <IconButton size="small" color="error" onClick={() => onDelete(item)} aria-label={`Delete ${item.name}`}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </>
  );
}
