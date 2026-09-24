// ---------------------------------------------------------------------------
// STEP 3 — Services, Packages & Parts.
//
// Catalogue tabs on the left, the editable line item table in the middle and a
// live financial summary. Every change runs through the tax engine via the
// slice, so totals can never drift from the items on screen.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { showToast } from '../../../redux/uiSlice';
import {
  addLineItem,
  duplicateLineItem,
  removeLineItem,
  selectEstimate,
  selectEstimateConfig,
  updateLineItem,
} from '../../../redux/estimateSlice';
import {
  lineItemFromLabour,
  lineItemFromPackage,
  lineItemFromPart,
  lineItemFromService,
} from '../../../utils/lineItemFactory';
import type {
  CatalogLabour,
  CatalogPackage,
  CatalogPart,
  CatalogService,
  EstimateLineItem,
} from '../../../services/estimate/types';
import CatalogPicker from '../../../components/estimate/CatalogPicker';
import LineItemTable from '../../../components/estimate/LineItemTable';
import LineItemForm from '../../../components/estimate/LineItemForm';
import EstimateTotals from '../../../components/estimate/EstimateTotals';
import { ConfirmDialog, SectionCard } from '../../../components/estimate/primitives';

export default function ServicesStep() {
  const dispatch = useDispatch();
  const estimate = useSelector(selectEstimate);
  const config = useSelector(selectEstimateConfig);

  const [editing, setEditing] = useState<EstimateLineItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EstimateLineItem | null>(null);

  const items = estimate.lineItems || [];

  const addFromCatalog = (item: EstimateLineItem, label: string) => {
    dispatch(addLineItem(item));
    dispatch(showToast({ severity: 'success', message: `${label} added to the estimate` }));
  };

  const openCustom = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSave = (item: EstimateLineItem) => {
    if (items.some((i) => i.id === item.id)) {
      dispatch(updateLineItem({ id: item.id, patch: item }));
      dispatch(showToast({ severity: 'success', message: 'Item updated' }));
    } else {
      dispatch(addLineItem(item));
      dispatch(showToast({ severity: 'success', message: 'Item added' }));
    }
    setFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    dispatch(removeLineItem(pendingDelete.id));
    dispatch(showToast({ severity: 'info', message: `${pendingDelete.name} removed from the estimate` }));
    setPendingDelete(null);
  };

  const lineItemErrors = estimate.errors || {};

  return (
    <Box>
      <Grid container spacing={2.5}>
        {/* ------------------------------ main column ---------------------------- */}
        <Grid item xs={12} md={8}>
          <CatalogPicker
            vehicleType={estimate.vehicle.type}
            defaultTaxRate={config.defaultTaxRate}
            onAddService={(service: CatalogService) =>
              addFromCatalog(lineItemFromService(service), service.name)
            }
            onAddPackage={(pkg: CatalogPackage) => addFromCatalog(lineItemFromPackage(pkg), pkg.name)}
            onAddPart={(part: CatalogPart) => addFromCatalog(lineItemFromPart(part), part.name)}
            onAddLabour={(labour: CatalogLabour) =>
              addFromCatalog(lineItemFromLabour(labour), labour.description)
            }
            onAddCustom={openCustom}
          />

          <Box sx={{ mt: 2.5 }}>
            <SectionCard
              title="Estimate Items"
              subtitle="Edit quantities, rates and discounts inline"
              action={
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={openCustom}>
                    Add Item
                  </Button>
                  {items.length > 0 && (
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => setPendingDelete({ id: '__all__', name: 'All items' } as EstimateLineItem)}
                    >
                      Clear
                    </Button>
                  )}
                </Stack>
              }
            >
              {Object.keys(lineItemErrors).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {Object.entries(lineItemErrors).map(([path, message]) => (
                    <Typography key={path} variant="body2" color="error.main">
                      ⚠ {message}
                    </Typography>
                  ))}
                </Box>
              )}

              <LineItemTable
                items={items}
                onInlineChange={(id, patch) => dispatch(updateLineItem({ id, patch }))}
                onEdit={(item) => {
                  setEditing(item);
                  setFormOpen(true);
                }}
                onDuplicate={(id) => {
                  dispatch(duplicateLineItem(id));
                  dispatch(showToast({ severity: 'info', message: 'Item duplicated' }));
                }}
                onDelete={(item) => setPendingDelete(item)}
                onAddItem={openCustom}
                emptyAction={
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCustom}>
                    Add Item
                  </Button>
                }
              />

              {items.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Chip label={`${items.filter((i) => i.type === 'service').length} services`} size="small" variant="outlined" />
                  <Chip label={`${items.filter((i) => i.type === 'package').length} packages`} size="small" variant="outlined" />
                  <Chip label={`${items.filter((i) => i.type === 'part').length} parts`} size="small" variant="outlined" />
                  <Chip label={`${items.filter((i) => i.type === 'labour').length} labour`} size="small" variant="outlined" />
                  <Chip label={`${items.filter((i) => i.type === 'custom').length} custom`} size="small" variant="outlined" />
                </Stack>
              )}
            </SectionCard>
          </Box>
        </Grid>

        {/* ----------------------------- summary rail ---------------------------- */}
        <Grid item xs={12} md={4}>
          <EstimateTotals totals={estimate.totals} config={config} itemCount={items.length} sticky />
        </Grid>
      </Grid>

      <LineItemForm
        open={formOpen}
        initial={editing}
        defaultTaxRate={config.defaultTaxRate}
        onSave={handleSave}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.id === '__all__' ? 'Remove all items?' : 'Delete this item?'}
        message={
          pendingDelete?.id === '__all__'
            ? 'Every service, package, part and labour line will be removed from this estimate.'
            : `${pendingDelete?.name} will be removed from the estimate and from the totals immediately.`
        }
        confirmLabel={pendingDelete?.id === '__all__' ? 'Remove all' : 'Delete'}
        destructive
        onConfirm={() => {
          if (pendingDelete?.id === '__all__') {
            items.forEach((item) => dispatch(removeLineItem(item.id)));
            dispatch(showToast({ severity: 'info', message: 'All items removed' }));
            setPendingDelete(null);
            return;
          }
          confirmDelete();
        }}
        onClose={() => setPendingDelete(null)}
      />
    </Box>
  );
}
