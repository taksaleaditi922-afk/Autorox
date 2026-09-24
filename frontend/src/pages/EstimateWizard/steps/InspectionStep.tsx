// ---------------------------------------------------------------------------
// STEP 2 — Digital Inspection Report.
//
// Categories -> inspection points -> status + notes + photos/videos -> raise a
// service straight from a finding. Categories and points are configurable, and
// every note is persisted in the estimate state so navigating between steps
// never loses it.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddTaskIcon from '@mui/icons-material/AddTask';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { showToast } from '../../../redux/uiSlice';
import {
  addInspectionCategory,
  addInspectionItem,
  addLineItem,
  linkServiceToInspection,
  removeInspectionCategory,
  removeInspectionItem,
  selectEstimate,
  selectEstimateConfig,
  setCategoryStatus,
  setInspectionMedia,
  setInspectionNotes,
  setInspectionStatus,
} from '../../../redux/estimateSlice';
import { INSPECTION_STATUS_META, INSPECTION_STATUSES } from '../../../services/estimate/config';
import * as inspectionService from '../../../services/estimate/inspectionService';
import { lineItemFromService, withInspectionLink } from '../../../utils/lineItemFactory';
import type { CatalogService, InspectionCategory, InspectionItem, InspectionStatus } from '../../../services/estimate/types';
import MediaUploader from '../../../components/estimate/MediaUploader';
import InspectionStatusSelector from '../../../components/estimate/InspectionStatusSelector';
import ServiceLinkModal, { type InspectionTarget } from '../../../components/estimate/ServiceLinkModal';
import { EmptyState, SectionCard, StatusChip } from '../../../components/estimate/primitives';

type FilterMode = 'all' | 'issues' | 'pending';

export default function InspectionStep() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const estimate = useSelector(selectEstimate);
  const config = useSelector(selectEstimateConfig);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [expanded, setExpanded] = useState<string | false>(estimate.inspection?.[0]?.id ?? false);
  const [linkTarget, setLinkTarget] = useState<InspectionTarget | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', sortOrder: 99, isActive: true });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [newItemFor, setNewItemFor] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const categories = estimate.inspection || [];
  const summary = useMemo(() => inspectionService.summarise(categories), [categories]);
  const progress = summary.total ? Math.round((summary.inspected / summary.total) * 100) : 0;

  const visibleItems = (category: InspectionCategory): InspectionItem[] => {
    if (filter === 'all') return category.items;
    if (filter === 'issues') return category.items.filter((i) => i.status === 'attention' || i.status === 'critical');
    return category.items.filter((i) => i.status === 'na');
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    const created = inspectionService.createInspectionCategory(
      newCategory.name,
      newCategory.description,
      newCategory.sortOrder
    );
    created.isActive = newCategory.isActive;

    // Best-effort server registration; the estimate carries the category either way.
    const saved = await inspectionService.saveCategory(created);
    dispatch(addInspectionCategory(saved));
    setNewCategoryOpen(false);
    setNewCategory({ name: '', description: '', sortOrder: 99, isActive: true });
    setCategoryError(null);
    setExpanded(saved.id);
    dispatch(showToast({ severity: 'success', message: `Inspection category "${saved.name}" added` }));
  };

  const handleAddItem = (categoryId: string) => {
    if (!newItemName.trim()) return;
    dispatch(addInspectionItem({ categoryId, itemName: newItemName.trim() }));
    setNewItemName('');
    setNewItemFor(null);
  };

  const handleLinkService = (service: CatalogService, quantity: number) => {
    if (!linkTarget) return;
    const category = categories.find((c) => c.id === linkTarget.categoryId);
    if (!category) return;

    const item = category.items.find((i) => i.id === linkTarget.itemId);
    if (!item) return;

    const lineItem = withInspectionLink(
      lineItemFromService(service, quantity),
      category,
      item
    );

    dispatch(addLineItem(lineItem));
    dispatch(
      linkServiceToInspection({
        categoryId: category.id,
        itemId: item.id,
        lineItemId: lineItem.id,
      })
    );
    dispatch(showToast({ severity: 'success', message: `${service.name} added to the estimate` }));
  };

  return (
    <Box>
      {/* --------------------------- summary + filter --------------------------- */}
      <SectionCard
        title="Inspection Progress"
        subtitle={`${summary.inspected} of ${summary.total} points inspected`}
        action={
          <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={() => setNewCategoryOpen(true)}>
            Add New Category
          </Button>
        }
      >
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, mb: 2 }} />

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {INSPECTION_STATUSES.map((status) => {
            const meta = INSPECTION_STATUS_META[status];
            const count = summary[status];
            return (
              <Grid item xs={6} sm={3} key={status}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: `${meta.hex}0f`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box component="span" aria-hidden="true" sx={{ color: meta.hex, fontWeight: 800 }}>
                    {meta.icon}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }}>
                      {meta.label}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                      {count}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {(
            [
              { value: 'all', label: `All (${summary.total})` },
              { value: 'issues', label: `Needs attention (${summary.attention + summary.critical})` },
              { value: 'pending', label: `Not inspected (${summary.na})` },
            ] as { value: FilterMode; label: string }[]
          ).map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              onClick={() => setFilter(option.value)}
              color={filter === option.value ? 'primary' : 'default'}
              variant={filter === option.value ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      </SectionCard>

      {summary.issues.length > 0 && (
        <SectionCard title="Findings to Quote" subtitle="Critical and attention items captured so far" dense>
          <Stack spacing={0.75}>
            {summary.issues.map((issue) => (
              <Box
                key={issue.itemId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  flexWrap: 'wrap',
                }}
              >
                <StatusChip label={INSPECTION_STATUS_META[issue.status].label} color={INSPECTION_STATUS_META[issue.status].color as any} />
                <Typography variant="body2" fontWeight={700}>
                  {issue.itemName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {issue.categoryName}
                </Typography>
                {issue.mediaCount > 0 && (
                  <Chip size="small" variant="outlined" label={`${issue.mediaCount} media`} />
                )}
                {issue.linkedServiceIds.length > 0 ? (
                  <Chip size="small" color="success" label={`${issue.linkedServiceIds.length} service added`} />
                ) : (
                  <Button
                    size="small"
                    startIcon={<AddTaskIcon fontSize="small" />}
                    sx={{ ml: 'auto' }}
                    onClick={() =>
                      setLinkTarget({
                        categoryId: issue.categoryId,
                        categoryName: issue.categoryName,
                        itemId: issue.itemId,
                        itemName: issue.itemName,
                        status: issue.status,
                      })
                    }
                  >
                    Add Service
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        </SectionCard>
      )}

      {/* ------------------------------ categories ----------------------------- */}
      {categories.length === 0 ? (
        <EmptyState
          title="No inspection categories"
          description="Add a category to start recording the vehicle's condition."
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewCategoryOpen(true)}>
              Add New Category
            </Button>
          }
        />
      ) : (
        categories.map((category) => {
          const items = visibleItems(category);
          return (
            <Accordion
              key={category.id}
              expanded={expanded === category.id}
              onChange={(_e, isExpanded) => setExpanded(isExpanded ? category.id : false)}
              disableGutters
              sx={{
                mb: 1.5,
                '&:before': { display: 'none' },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '16px !important',
                overflow: 'hidden',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexGrow: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {category.name}
                  </Typography>
                  {category.isCustom && <Chip size="small" variant="outlined" label="Custom" />}
                  <Chip size="small" variant="outlined" label={`${category.items.length} points`} />
                  {category.items.some((i) => i.status === 'critical') && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'error.main' }}>
                      <WarningAmberIcon sx={{ fontSize: 15 }} />
                      <Typography variant="caption" fontWeight={700}>
                        Critical
                      </Typography>
                    </Box>
                  )}
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ pt: 0 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => dispatch(setCategoryStatus({ categoryId: category.id, status: 'good', onlyUnset: true }))}
                  >
                    Mark unchecked as Good
                  </Button>
                  <Button size="small" variant="text" onClick={() => setNewItemFor(category.id)} startIcon={<AddIcon fontSize="small" />}>
                    Add Inspection Point
                  </Button>
                  {category.isCustom && (
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => dispatch(removeInspectionCategory(category.id))}
                    >
                      Remove Category
                    </Button>
                  )}
                </Stack>

                {newItemFor === category.id && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      autoFocus
                      label="Inspection point name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddItem(category.id)}
                    />
                    <Button variant="contained" size="small" onClick={() => handleAddItem(category.id)}>
                      Add
                    </Button>
                  </Box>
                )}

                {items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {filter === 'issues'
                      ? 'No critical or attention items in this category.'
                      : filter === 'pending'
                      ? 'Every point in this category has been inspected.'
                      : 'No inspection points yet.'}
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {items.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.75,
                          borderRadius: 2.5,
                          border: '1px solid',
                          borderColor: item.status === 'critical' ? 'error.light' : item.status === 'attention' ? 'warning.light' : 'divider',
                          bgcolor: item.status === 'critical' ? 'error.light' : item.status === 'attention' ? 'warning.light' : 'background.paper',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="body2" fontWeight={800}>
                              {item.name}
                            </Typography>
                            {item.linkedServiceIds?.length > 0 && (
                              <Chip size="small" color="info" variant="outlined" label={`${item.linkedServiceIds.length} service linked`} />
                            )}
                          </Box>
                          {category.isCustom && (
                            <Tooltip title="Remove inspection point">
                              <IconButton
                                size="small"
                                onClick={() => dispatch(removeInspectionItem({ categoryId: category.id, itemId: item.id }))}
                                aria-label={`Remove ${item.name}`}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>

                        <InspectionStatusSelector
                          name={item.name}
                          value={item.status}
                          size={isMobile ? 'small' : 'medium'}
                          onChange={(status: InspectionStatus) =>
                            dispatch(setInspectionStatus({ categoryId: category.id, itemId: item.id, status }))
                          }
                        />

                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          size="small"
                          label="Notes"
                          value={item.notes}
                          onChange={(e) => dispatch(setInspectionNotes({ categoryId: category.id, itemId: item.id, notes: e.target.value }))}
                          sx={{ mt: 1.5 }}
                          inputProps={{ 'aria-label': `Notes for ${item.name}` }}
                        />

                        <Box sx={{ mt: 1.5 }}>
                          <MediaUploader
                            media={item.media || []}
                            estimateId={estimate.draftId}
                            scope="inspection"
                            itemId={item.id}
                            compact={isMobile}
                            onChange={(media) => dispatch(setInspectionMedia({ categoryId: category.id, itemId: item.id, media }))}
                          />
                        </Box>

                        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddTaskIcon fontSize="small" />}
                            onClick={() =>
                              setLinkTarget({
                                categoryId: category.id,
                                categoryName: category.name,
                                itemId: item.id,
                                itemName: item.name,
                                status: item.status,
                              })
                            }
                          >
                            Add Service
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      {/* --------------------------- add category modal ------------------------ */}
      <Dialog open={newCategoryOpen} onClose={() => setNewCategoryOpen(false)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Add Inspection Category</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                autoFocus
                label="Category Name"
                value={newCategory.name}
                onChange={(e) => setNewCategory((c) => ({ ...c, name: e.target.value }))}
                error={Boolean(categoryError)}
                helperText={categoryError}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Description"
                value={newCategory.description}
                onChange={(e) => setNewCategory((c) => ({ ...c, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Sort Order"
                value={newCategory.sortOrder}
                onChange={(e) => setNewCategory((c) => ({ ...c, sortOrder: Number(e.target.value) || 0 }))}
              />
            </Grid>
            <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newCategory.isActive}
                    onChange={(e) => setNewCategory((c) => ({ ...c, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Add the individual inspection points after creating the category — for example “Underbody”, “EV Battery Health”.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setNewCategoryOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCategory}>
            Create Category
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------------------------- service linking -------------------------- */}
      <ServiceLinkModal
        open={Boolean(linkTarget)}
        target={linkTarget}
        onAdd={handleLinkService}
        onClose={() => setLinkTarget(null)}
      />

      {estimate.draftId === null && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
          Media uploads need a saved draft. Your notes and statuses are kept in this browser until then.
        </Typography>
      )}

      <Box sx={{ mt: 2, display: { xs: 'none', sm: 'block' } }}>
        <Typography variant="caption" color="text.muted">
          Inspection data is stored on the estimate{config.company?.name ? ` for ${config.company.name}` : ''} and travels with it through
          generation, PDF export and sharing.
        </Typography>
      </Box>
    </Box>
  );
}
