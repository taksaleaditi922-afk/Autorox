// ---------------------------------------------------------------------------
// <CatalogPicker /> — the Step 3 catalog browser.
//
// Tabs: Services / Packages / Parts / Labour / Custom.
// Search is debounced, requests are abortable, results are paginated, and every
// list has proper loading / empty / error states.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { formatCurrency } from '../../utils/format';
import { useDebounce } from '../../utils/useDebounce';
import * as catalogService from '../../services/estimate/catalogService';
import type {
  CatalogFilters,
  CatalogLabour,
  CatalogPage,
  CatalogPackage,
  CatalogPart,
  CatalogService,
  VehicleType,
} from '../../services/estimate/types';
import { EmptyState, InlineAlert } from './primitives';

export type CatalogTab = 'services' | 'packages' | 'parts' | 'labour' | 'custom';

/** A catalogue row picked by the caller, tagged with the tab it came from. */
export interface CatalogSelection {
  tab: CatalogTab;
  item: any;
}

export interface CatalogPickerProps {
  vehicleType?: VehicleType;
  defaultTaxRate?: number;
  /** Tab to open on mount. */
  initialTab?: CatalogTab;
  /** When true a checkbox appears on every card and items are added in a batch. */
  multiSelect?: boolean;
  onAddService: (service: CatalogService) => void;
  onAddPackage: (pkg: CatalogPackage) => void;
  onAddPart: (part: CatalogPart) => void;
  onAddLabour: (labour: CatalogLabour) => void;
  onAddCustom: () => void;
  /** Called with every selected row when "Add selected" is pressed. */
  onAddMany?: (selection: CatalogSelection[]) => void;
}

const TABS: { value: CatalogTab; label: string }[] = [
  { value: 'services', label: 'Services' },
  { value: 'packages', label: 'Packages' },
  { value: 'parts', label: 'Parts' },
  { value: 'labour', label: 'Labour' },
  { value: 'custom', label: 'Custom' },
];

export default function CatalogPicker({
  vehicleType,
  initialTab,
  multiSelect = false,
  onAddService,
  onAddPackage,
  onAddPart,
  onAddLabour,
  onAddCustom,
  onAddMany,
}: CatalogPickerProps) {
  const [tab, setTab] = useState<CatalogTab>(initialTab || 'services');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CatalogPage<Record<string, any>>>({
    data: [],
    pagination: { page: 1, limit: 8, total: 0, totalPages: 1 },
  });
  const [selection, setSelection] = useState<CatalogSelection[]>([]);

  const debouncedQuery = useDebounce(query, 350);
  const abortRef = useRef<AbortController | null>(null);
  const facets = useMemo(() => catalogService.catalogFacets(), []);

  const load = useCallback(async () => {
    if (tab === 'custom') {
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const filters: CatalogFilters = {
      q: debouncedQuery,
      category,
      brand,
      minPrice: '',
      maxPrice: '',
      page,
      limit: 8,
      vehicleType,
    };

    try {
      const search =
        tab === 'services'
          ? catalogService.searchServices
          : tab === 'packages'
          ? catalogService.searchPackages
          : tab === 'parts'
          ? catalogService.searchParts
          : catalogService.searchLabour;

      const res = await search(filters, controller.signal);
      setResult(res);
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        setError('Could not load the catalogue. Showing what is available locally.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [tab, debouncedQuery, category, brand, page, vehicleType]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => {
    setPage(1);
    // A tab switch starts a new selection — services and parts should not be
    // added together by accident.
    setSelection([]);
  }, [tab, debouncedQuery, category, brand]);

  const items = result.data as any[];

  const toggleSelected = (next: CatalogSelection) => {
    setSelection((current) => {
      const exists = current.some((row) => row.tab === next.tab && row.item?.id === next.item?.id);
      return exists ? current.filter((row) => !(row.tab === next.tab && row.item?.id === next.item?.id)) : [...current, next];
    });
  };

  const isSelected = (item: any) => selection.some((row) => row.tab === tab && row.item?.id === item?.id);

  return (
    <Card>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
        <Tabs
          value={tab}
          onChange={(_e, value: CatalogTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Catalogue categories"
        >
          {TABS.map((t) => (
            <Tab key={t.value} label={t.label} value={t.value} />
          ))}
        </Tabs>
      </Box>

      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {tab === 'custom' ? (
          <EmptyState
            title="Add a custom item"
            description="For anything not in the catalogue — one-off charges, consumables, sublet work."
            action={
              <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={onAddCustom}>
                Add Custom Item
              </Button>
            }
          />
        ) : (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                size="small"
                fullWidth
                label="Search"
                placeholder="Name, part number, brand or HSN/SAC code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              {tab === 'services' && (
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {facets.serviceCategories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {tab === 'parts' && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {facets.partCategories.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {facets.partBrands.map((b) => (
                      <MenuItem key={b} value={b}>
                        {b}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
            </Stack>

            {error && (
              <InlineAlert
                severity="warning"
                action={
                  <Button size="small" startIcon={<RefreshIcon fontSize="small" />} onClick={() => void load()}>
                    Retry
                  </Button>
                }
              >
                {error}
              </InlineAlert>
            )}

            {loading ? (
              <Grid container spacing={1.5}>
                {[...Array(4)].map((_, i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Skeleton variant="rounded" height={96} />
                  </Grid>
                ))}
              </Grid>
            ) : items.length === 0 ? (
              <EmptyState
                title="No matches found"
                description="Try a different search term, or clear the filters."
                action={
                  <Button
                    size="small"
                    onClick={() => {
                      setQuery('');
                      setCategory('');
                      setBrand('');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                <Grid container spacing={1.5}>
                  {items.map((item: any) => (
                    <Grid item xs={12} sm={6} key={item.id}>
                      <CatalogCard
                        tab={tab}
                        item={item}
                        selectable={multiSelect}
                        selected={multiSelect && isSelected(item)}
                        onToggle={() => toggleSelected({ tab, item })}
                        onAdd={(picked) => {
                          if (tab === 'services') onAddService(picked as CatalogService);
                          else if (tab === 'packages') onAddPackage(picked as CatalogPackage);
                          else if (tab === 'parts') onAddPart(picked as CatalogPart);
                          else onAddLabour(picked as CatalogLabour);
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>

                {result.pagination.totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      size="small"
                      count={result.pagination.totalPages}
                      page={result.pagination.page}
                      onChange={(_e, value) => setPage(value)}
                    />
                  </Box>
                )}
                <Typography variant="caption" color="text.muted" sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}>
                  {result.pagination.total} result{result.pagination.total === 1 ? '' : 's'}
                </Typography>
              </>
            )}
          </>
        )}
      </CardContent>

      {multiSelect && selection.length > 0 && (
        <Paper
          elevation={6}
          sx={{
            position: 'sticky',
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 2,
            py: 1.25,
            borderRadius: '0 0 12px 12px',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {selection.length} item{selection.length === 1 ? '' : 's'} selected
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setSelection([])}>
              Clear
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon fontSize="small" />}
              onClick={() => {
                onAddMany?.(selection);
                setSelection([]);
              }}
            >
              Add selected
            </Button>
          </Stack>
        </Paper>
      )}
    </Card>
  );
}

function CatalogCard({
  tab,
  item,
  onAdd,
  selectable,
  selected,
  onToggle,
}: {
  tab: CatalogTab;
  item: any;
  onAdd: (item: any) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const price = tab === 'packages' ? item.price : item.rate;

  return (
    <Card variant="outlined" sx={{ height: '100%', '&:hover': { borderColor: 'primary.main' } }}>
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700}>
              {tab === 'labour' ? item.description : item.name}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
              {item.category && <Chip label={item.category} size="small" variant="outlined" />}
              {item.brand && <Chip label={item.brand} size="small" variant="outlined" />}
              {item.partNumber && <Chip label={item.partNumber} size="small" variant="outlined" />}
              {item.hsnSacCode && <Chip label={`SAC ${item.hsnSacCode}`} size="small" variant="outlined" />}
              {item.hsnCode && <Chip label={`HSN ${item.hsnCode}`} size="small" variant="outlined" />}
              {typeof item.stock === 'number' && (
                <Chip
                  label={item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                  size="small"
                  color={item.stock > 0 ? 'success' : 'error'}
                />
              )}
            </Stack>
            {item.description && tab !== 'labour' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {item.description}
              </Typography>
            )}
            {tab === 'packages' && item.contents?.length ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Includes: {item.contents.map((c: any) => c.name).join(', ')}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {formatCurrency(price)}
            </Typography>
            <Typography variant="caption" color="text.muted">
              + {item.taxRate ?? 18}% tax
            </Typography>
            <Typography variant="caption" color="text.muted" sx={{ display: 'block' }}>
              per {item.unit || 'job'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 'auto', pt: 1.5, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
          {selectable && (
            <Checkbox
              size="small"
              checked={Boolean(selected)}
              onChange={() => onToggle?.()}
              inputProps={{ 'aria-label': `Select ${item.name || item.description}` }}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => onAdd(item)}
            aria-label={`Add ${item.name || item.description} to the estimate`}
          >
            Add
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Re-exported so callers do not need to import the service module directly. */
export type { CatalogPage };
