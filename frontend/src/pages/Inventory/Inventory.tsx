import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useDebounce } from '../../utils/useDebounce';
import type { RootState } from '../../store/store';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, IconButton,
  Tabs, Tab, Table, TableHead, TableRow, TableBody, TableCell, TableContainer,
  TablePagination, Chip, Tooltip, Menu, MenuItem as MuiMenuItem, Divider,
  InputAdornment, Grid, Dialog, DialogTitle, DialogContent, DialogActions, Badge, Alert as MuiAlert,
  Popover, Drawer, useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  RemoveRedEye as ViewIcon,
  Edit as EditIcon,
  Inventory as StockIcon,
  TrendingUp as InsightsIcon,
  Refresh as ResetIcon,
  WarningAmber as WarningAmpIcon,
  OpenInNew as ReturnIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  ErrorOutline as AlertIcon,
  TrendingUp as TrendingUpIcon,
  NotificationsActive as NotificationsActiveIcon,
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  UploadFile as UploadFileIcon,
  FilterList as FilterIcon,
  CurrencyRupee as RupeeIcon,
  DirectionsCar as VehicleIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import Loader from '../../components/Loader';
import useT from '../../i18n/useT';
import {
  fetchInventoryList,
  fetchInventoryOptionsThunk,
  fetchInventoryStatsThunk,
  fetchInventoryInsightsThunk,
  fetchStockAlertsThunk,
  fetchPurchaseOrdersThunk,
  fetchInwardRecordsThunk,
  fetchIssuedRecordsThunk,
  fetchPurchaseReturnsThunk,
  fetchInventoryItemThunk,
  updateStockThunk,
  recordStockMovementThunk,
  fetchStockHistoryThunk,
  saveInventoryProductThunk,
  deleteInventoryProductThunk,
  changeProductStockThunk,
  resetCurrentItem,
} from '../../redux/inventorySlice';
import {
  INVENTORY_TABS, PAGE_SIZES,
  STOCK_STATUS_LABELS, STOCK_STATUS_COLORS,
  AGEING_BUCKETS,
  COLUMNS,
  computeStockStatus, computeAgeingDays, getAgeingBucket,
  getDefaultFilters,
  formatBarcode, buildInventoryParams, downloadInventoryFile,
} from '../../services/inventoryService';
import type { InventoryFilters, InventoryItem, StockAlert, StockMovement } from '../../services/inventoryService';
import PartFormDialog from './PartFormDialog';
import InventoryPageHeader from './InventoryPageHeader';
import CsvImportDialog from './CsvImportDialog';
import { showToast } from '../../redux/uiSlice';
// ---------------------------------------------------------------------------
// Debounce hook (kept local to avoid importing a utility that may not exist)
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

const TAB_IDS = INVENTORY_TABS.map((t) => t.id);

/** Resolves the comparable value for a column `field`, including the derived
 *  columns that are not stored on the item itself (status, ageing, stock value). */
function getCellValue(item: InventoryItem, field: string): string | number | null {
  const record = item as unknown as Record<string, any>;

  switch (field) {
    case 'stockStatus':
      return computeStockStatus(item);
    case 'ageing':
      return computeAgeingDays(item);
    case 'inventoryValue':
      return (item.inventory?.quantity ?? 0) * (item.pricing?.costPrice ?? 0);
    case 'lastPurchaseDate':
    case 'lastMovementDate':
    case 'createdAt':
    case 'updatedAt': {
      const raw = record[field];
      return raw ? new Date(raw).getTime() : null;
    }
    default: {
      const raw = field
        .split('.')
        .reduce<any>((acc, key) => (acc == null ? acc : acc[key]), record);
      return raw ?? null;
    }
  }
}

/** Header labels for the stock table. Multi-line labels use "\n" and are
 *  rendered with `white-space: pre-line` so they wrap onto two lines like the
 *  reference layout. */
const HEADER_LABELS: Record<string, string> = {
  barcode: 'Bar\nCode',
  productName: 'Part Name',
  productCode: 'Part Number',
  vehicleType: 'Vehicle\nType',
  'inventory.quantity': 'Available\nQuantity',
  category: 'Category',
  subCategory: 'Sub\nCategory',
  'inventory.location': 'Location',
  'pricing.costPrice': 'Purchase Price',
  'pricing.sellingPrice': 'Selling Price',
  stockActions: 'Stock',
  partType: 'Part\nType',
  history: 'Part\nHistory',
  remark: 'Remark',
  employeeName: 'Employee\nName',
  age: 'Age',
  delete: 'Delete',
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  'in-stock': 'In Stock',
  'out-of-stock': 'Out of Stock',
  'low-stock': 'Low Stock',
};

/** Compact stat card: value on top, label below, round tinted icon on the right. */
function StatCard({ label, value, icon, tint, color }: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tint: string;
  color: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, height: '100%' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={800} sx={{ color: 'primary.main', lineHeight: 1.15, fontSize: { xs: '1.4rem', md: '1.5rem' } }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{label}</Typography>
        </Box>
        <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: tint, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
      </CardContent>
    </Card>
  );
}

/** All existing filters, relocated into a popover (desktop) / bottom sheet
 *  (mobile). Every field keeps its original value, onChange and API param. */
function FilterPanel({
  t,
  filters,
  setFilters,
  quickFilters,
  handleQuickFilter,
  resetFilters,
  locationOptions,
  categoryOptions,
  state,
  onClose,
}: {
  t: ReturnType<typeof useT>;
  filters: InventoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFilters>>;
  quickFilters: string;
  handleQuickFilter: (key: string) => void;
  resetFilters: () => void;
  locationOptions: string[];
  categoryOptions: string[];
  state: RootState['inventory'];
  onClose: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Filters</Typography>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {(['all', 'in-stock', 'out-of-stock', 'reorder-level'] as const).map((key) => (
          <Chip
            key={key}
            label={t(`inventory.filter.${key === 'in-stock' ? 'inStock' : key === 'out-of-stock' ? 'outOfStock' : key === 'reorder-level' ? 'reorder' : 'all'}`)}
            onClick={() => handleQuickFilter(key)}
            clickable
            color={(key === 'reorder-level' ? quickFilters === 'low-stock' : quickFilters === key) ? 'primary' : 'default'}
            variant={(key === 'reorder-level' ? quickFilters === 'low-stock' : quickFilters === key) ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
        ))}
      </Box>

      <TextField select size="small" fullWidth label="Vehicle Type" value={filters.vehicleType || ''} onChange={(e) => setFilters((f) => ({ ...f, vehicleType: e.target.value, page: 1 }))}>
        <MenuItem value="">All Vehicles</MenuItem>
        {state.options.vehicleTypes.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
      </TextField>

      <TextField select size="small" fullWidth label="Part Type" value={filters.partType || ''} onChange={(e) => setFilters((f) => ({ ...f, partType: e.target.value, page: 1 }))}>
        <MenuItem value="">All Part Types</MenuItem>
        {state.options.partTypes.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
      </TextField>

      <TextField select size="small" fullWidth label={t('inventory.filter.location')} value={filters.location || ''} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value, page: 1 }))}>
        {locationOptions.map((opt) => <MenuItem key={opt} value={opt === 'All Locations' ? '' : opt}>{opt}</MenuItem>)}
      </TextField>

      <TextField select size="small" fullWidth label={t('inventory.filter.category')} value={filters.category || ''} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}>
        {categoryOptions.map((opt) => <MenuItem key={opt} value={opt === 'All Categories' ? '' : opt}>{opt}</MenuItem>)}
      </TextField>

      <TextField select size="small" fullWidth label={t('inventory.filter.status')} value={filters.stockStatus || 'all'} onChange={(e) => setFilters((f) => ({ ...f, stockStatus: e.target.value, inStock: undefined, outOfStock: undefined, reorderLevel: undefined, page: 1 }))}>
        <MenuItem value="all">{t('inventory.filter.allStatuses')}</MenuItem>
        <MenuItem value="in-stock">In Stock</MenuItem>
        <MenuItem value="out-of-stock">Out of Stock</MenuItem>
        <MenuItem value="low-stock">Low Stock</MenuItem>
      </TextField>

      <TextField select size="small" fullWidth label={t('inventory.filter.ageing')} value={filters.ageing || 'all'} onChange={(e) => setFilters((f) => ({ ...f, ageing: e.target.value }))}>
        <MenuItem value="all">{t('inventory.filter.all')}</MenuItem>
        <MenuItem value="fresh">{t('inventory.filter.fresh')}</MenuItem>
        <MenuItem value="ageing">{t('inventory.filter.ageingRange')}</MenuItem>
        <MenuItem value="dead">{t('inventory.filter.dead')}</MenuItem>
      </TextField>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" type="number" fullWidth label={`${t('inventory.filter.priceRange')} (Min)`} value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value, page: 1 }))} />
        <TextField size="small" type="number" fullWidth label={`${t('inventory.filter.priceRange')} (Max)`} value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value, page: 1 }))} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" type="number" fullWidth label={`${t('inventory.filter.qtyRange')} (Min)`} value={filters.minQty} onChange={(e) => setFilters((f) => ({ ...f, minQty: e.target.value, page: 1 }))} />
        <TextField size="small" type="number" fullWidth label={`${t('inventory.filter.qtyRange')} (Max)`} value={filters.maxQty} onChange={(e) => setFilters((f) => ({ ...f, maxQty: e.target.value, page: 1 }))} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
        <Button variant="contained" fullWidth onClick={onClose}>Apply</Button>
        <Button variant="outlined" fullWidth onClick={resetFilters}>Clear all</Button>
      </Box>
    </Box>
  );
}

interface InventoryProps {
  // The page is rendered inside Layout; no extra props.
}

export default function Inventory(props: InventoryProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const t = useT();
  const state = useAppSelector((s) => s.inventory);
  const user = useAppSelector((s) => s.auth.user);
  const { toggleDrawer } = (useOutletContext() as { toggleDrawer?: () => void } | null) || {};
  const isMobile = useMediaQuery('(max-width:900px)');
  const canEdit = user?.role === 'Admin' || user?.role === 'Service Manager';

  const [tab, setTab] = useState<InventoryTabId>('stock');
  const [filters, setFilters] = useState<InventoryFilters>(getDefaultFilters);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [rowsPerPage, setRowsPerPage] = useState(filters.limit);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [partFormOpen, setPartFormOpen] = useState(false);
  const [partFormSaving, setPartFormSaving] = useState(false);
  const [partFormError, setPartFormError] = useState('');
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ageDialogOpen, setAgeDialogOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [alertTypeFilter, setAlertTypeFilter] = useState<string | null>(null);
  const [alertMenuAnchor, setAlertMenuAnchor] = useState<null | HTMLElement>(null);

  const [movementForm, setMovementForm] = useState({
    mode: 'add' as 'add' | 'reduce',
    quantity: '',
    purchasePrice: '',
    reason: 'sale',
    note: '',
  });
  const [savingMovement, setSavingMovement] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Debounce search so each keystroke doesn't fire a request.
  const searchDebounced = useDebounce(filters.q, 300);

  // Refresh data when tab changes.
  useEffect(() => {
    refreshTabData(tab);
  }, [tab]);

  // Refresh list when filters (including debounced query, page, limit, sort) change.
  useEffect(() => {
    if (tab !== 'stock') return;
    dispatch(
      fetchInventoryList({
        ...filters,
        q: searchDebounced,
        page: filters.page,
        limit: rowsPerPage,
        sortField: sortField ?? undefined,
        sortOrder,
      })
    );
  }, [tab, dispatch, searchDebounced, filters.page, rowsPerPage, filters.category, filters.brand,
       filters.location, filters.workshopId, filters.stockStatus, filters.ageing,
       filters.vehicleType, filters.partType, filters.minPrice, filters.maxPrice,
       filters.minQty, filters.maxQty, sortField, sortOrder]);

  // Stats / insights load once per stock visit.
  useEffect(() => {
    if (tab === 'stock') {
      dispatch(fetchInventoryStatsThunk());
      dispatch(fetchInventoryInsightsThunk());
      dispatch(fetchInventoryOptionsThunk());
      dispatch(fetchStockAlertsThunk());
    }
  }, [tab]);

  // Alerts load once per stock-alert visit.
  useEffect(() => {
    if (tab === 'stock-alert') {
      dispatch(fetchStockAlertsThunk());
    }
  }, [tab]);

  // Orders / inward / issued / returns load once per their tab.
  useEffect(() => {
    if (tab === 'order') dispatch(fetchPurchaseOrdersThunk());
    if (tab === 'inward') dispatch(fetchInwardRecordsThunk());
    if (tab === 'issued') dispatch(fetchIssuedRecordsThunk());
    if (tab === 'purchase-return') dispatch(fetchPurchaseReturnsThunk());
  }, [tab, dispatch]);

  const refreshTabData = useCallback((newTab: typeof tab) => {
    if (newTab === 'stock') {
      dispatch(fetchInventoryList({ ...filters, q: searchDebounced, page: filters.page, limit: rowsPerPage }));
      dispatch(fetchInventoryStatsThunk());
      dispatch(fetchInventoryInsightsThunk());
    } else if (newTab === 'stock-alert') {
      dispatch(fetchStockAlertsThunk());
    } else if (newTab === 'order') {
      dispatch(fetchPurchaseOrdersThunk());
    } else if (newTab === 'inward') {
      dispatch(fetchInwardRecordsThunk());
    } else if (newTab === 'issued') {
      dispatch(fetchIssuedRecordsThunk());
    } else if (newTab === 'purchase-return') {
      dispatch(fetchPurchaseReturnsThunk());
    }
  }, [dispatch, filters, searchDebounced, rowsPerPage]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTab(TAB_IDS[newValue]);
  };

  const handleSearchChange = (value: string) => {
    setFilters((f) => ({ ...f, q: value, page: 1 }));
  };

  const handleQuickFilter = (key: string) => {
    if (key === 'all') {
      setFilters((f) => ({ ...f, page: 1, stockStatus: 'all', inStock: undefined, outOfStock: undefined, reorderLevel: undefined }));
    } else if (key === 'in-stock') {
      setFilters((f) => ({ ...f, page: 1, stockStatus: 'in-stock', inStock: true, outOfStock: undefined, reorderLevel: undefined }));
    } else if (key === 'out-of-stock') {
      setFilters((f) => ({ ...f, page: 1, stockStatus: 'out-of-stock', inStock: undefined, outOfStock: true, reorderLevel: undefined }));
    } else if (key === 'reorder-level') {
      setFilters((f) => ({ ...f, page: 1, stockStatus: 'low-stock', inStock: undefined, outOfStock: undefined, reorderLevel: true }));
    }
  };

  const handleAgeingBucketClick = (key: string) => {
    if (key === 'all') {
      setFilters((f) => ({ ...f, ageing: 'all', ...clearAgeingFilters(f) }));
    } else if (key === 'fresh') {
      setFilters((f) => ({ ...f, ageing: 'fresh' }));
    } else if (key === 'ageing') {
      setFilters((f) => ({ ...f, ageing: 'ageing' }));
    } else if (key === 'dead') {
      setFilters((f) => ({ ...f, ageing: 'dead' }));
    }
  };

  const clearAgeingFilters = (f: InventoryFilters): Partial<InventoryFilters> => {
    const out = { ...f };
    delete out.ageing;
    return out;
  };

  const handlePageChange = (_: unknown, newPage: number) => {
    setFilters((f) => ({ ...f, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isFinite(val) || val < 1) return;
    setRowsPerPage(val);
    setFilters((f) => ({ ...f, limit: val, page: 1 }));
  };

  const handleSort = (field: string, label: string) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortOrder('asc');
      return field;
    });
  };

  const resetFilters = () => {
    setFilters(getDefaultFilters());
    setSortField(null);
    setSortOrder('asc');
  };

  const openExportMenu = (e: React.MouseEvent<HTMLElement>) => setExportMenuAnchor(e.currentTarget);
  const closeExportMenu = () => setExportMenuAnchor(null);

  const handleExport = async (format: 'csv' | 'excel') => {
    closeExportMenu();
    if (format !== 'csv') return; // Excel export requires a backend endpoint today.
    setExporting(true);
    try {
      const params = buildInventoryParams({ ...filters, q: searchDebounced }, sortField || undefined, sortOrder);
      delete params.page;
      delete params.limit;
      const blob = await downloadInventoryFile('/inventory/export', params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const openDetail = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
    dispatch(fetchInventoryItemThunk(item.id));
    dispatch(fetchStockHistoryThunk({ productId: item.id }));
  };

  const openAlertDetail = (alert: StockAlert) => {
    setAlertMenuAnchor(null);
    setSelectedItem(null);
    setDetailOpen(true);
    dispatch(fetchInventoryItemThunk(alert.productId));
    dispatch(fetchStockHistoryThunk({ productId: alert.productId }));
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedItem(null);
    dispatch(resetCurrentItem());
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setPartFormError('');
    setPartFormOpen(true);
  };

  const openCreateModal = () => {
    navigate('/inventory/add');
  };

  const refreshInventory = () => {
    dispatch(fetchInventoryList({ ...filters, q: searchDebounced, page: filters.page, limit: rowsPerPage, sortField: sortField ?? undefined, sortOrder }));
    dispatch(fetchInventoryStatsThunk());
    dispatch(fetchStockAlertsThunk());
    dispatch(fetchInventoryOptionsThunk());
  };

  const handlePartSave = async (payload: Record<string, any>) => {
    setPartFormSaving(true);
    setPartFormError('');
    try {
      await dispatch(saveInventoryProductThunk({ id: selectedItem?.id, payload })).unwrap();
      setPartFormOpen(false);
      dispatch(showToast({ severity: 'success', message: selectedItem ? 'Part updated successfully' : 'Part added successfully' }));
      refreshInventory();
    } catch (error: any) {
      setPartFormError(String(error || 'Failed to save part'));
    } finally {
      setPartFormSaving(false);
    }
  };

  const openMovementModal = (item: InventoryItem, mode: 'add' | 'reduce') => {
    setSelectedItem(item);
    setMovementForm({ mode, quantity: '', purchasePrice: '', reason: 'sale', note: '' });
    setMovementModalOpen(true);
  };

  const handleMovementSave = async () => {
    if (!selectedItem) return;
    const qty = Number(movementForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (movementForm.mode === 'reduce' && qty > (selectedItem.inventory?.quantity ?? 0)) {
      dispatch(showToast({ severity: 'error', message: 'Reduction cannot exceed available stock' }));
      return;
    }
    setSavingMovement(true);
    try {
      await dispatch(changeProductStockThunk({
        id: selectedItem.id,
        mode: movementForm.mode,
        payload: {
          quantity: qty,
          purchasePrice: movementForm.mode === 'add' && movementForm.purchasePrice !== '' ? Number(movementForm.purchasePrice) : undefined,
          reason: movementForm.mode === 'reduce' ? movementForm.reason : 'purchase',
          note: movementForm.note,
        },
      })).unwrap();
      setMovementModalOpen(false);
      dispatch(showToast({ severity: 'success', message: movementForm.mode === 'add' ? 'Stock added successfully' : 'Stock reduced successfully' }));
      refreshInventory();
    } catch (error: any) {
      dispatch(showToast({ severity: 'error', message: String(error || 'Failed to update stock') }));
    } finally {
      setSavingMovement(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await dispatch(deleteInventoryProductThunk(selectedItem.id)).unwrap();
      setDeleteDialogOpen(false);
      dispatch(showToast({ severity: 'success', message: 'Part deleted successfully' }));
      refreshInventory();
    } catch (error: any) {
      dispatch(showToast({ severity: 'error', message: String(error || 'Failed to delete part') }));
    }
  };

  const columns = useMemo(() => COLUMNS, []);

  const pagination = state.items.length ? state.pagination : { page: 1, limit: rowsPerPage, total: state.items.length, totalPages: 1 };

  // Search, filters, sorting and pagination are applied by the API.
  const tableItems = state.items;
  const paginatedItems = state.items;

  const visibleCount = Math.min(paginatedItems.length, rowsPerPage);
  const totalDisplayed = pagination.total;

  if (tab === 'stock' && state.loading && !state.items.length) {
    return <Loader label={t('common.loadingDashboard')} />;
  }
  if (tab === 'stock-alert' && state.alertsLoading && !state.alerts.length) {
    return <Loader label={t('common.loadingDashboard')} />;
  }
  if (tab === 'order' && state.ordersLoading) {
    return <Loader label={t('common.loadingDashboard')} />;
  }
  if (tab === 'inward' && state.inwardLoading) {
    return <Loader label={t('common.loadingDashboard')} />;
  }
  if (tab === 'issued' && state.issuedLoading) {
    return <Loader label={t('common.loadingDashboard')} />;
  }
  if (tab === 'purchase-return' && state.returnsLoading) {
    return <Loader label={t('common.loadingDashboard')} />;
  }

  return (
    <Box sx={{ animation: 'fadeInUp 0.35s ease-out' }}>
      <InventoryPageHeader
        title={t('inventory.title')}
        avatarLabel={(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
        onMenuClick={toggleDrawer}
      >
          <Tooltip title="Low-stock alerts">
            <IconButton
              aria-label={`${state.alerts.length} inventory alerts`}
              onClick={(event) => setAlertMenuAnchor(event.currentTarget)}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 44, height: 44 }}
            >
              <Badge badgeContent={state.alerts.length} color="error" overlap="circular">
                <NotificationsActiveIcon sx={{ color: 'text.secondary' }} />
              </Badge>
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<UploadFileIcon fontSize="small" />}
            onClick={() => setCsvImportOpen(true)}
            disabled={!canEdit}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Upload Software CSV
          </Button>
          <IconButton
            aria-label="Upload Software CSV"
            onClick={() => setCsvImportOpen(true)}
            disabled={!canEdit}
            sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: 1, borderColor: 'divider', borderRadius: 2, width: 44, height: 44 }}
          >
            <UploadFileIcon fontSize="small" />
          </IconButton>

          <Menu anchorEl={alertMenuAnchor} open={Boolean(alertMenuAnchor)} onClose={() => setAlertMenuAnchor(null)} PaperProps={{ sx: { width: 360, maxHeight: 420 } }}>
            {state.alerts.length === 0 && <MuiMenuItem disabled>No low-stock alerts</MuiMenuItem>}
            {state.alerts.map((alert) => (
              <MuiMenuItem key={alert.id} onClick={() => openAlertDetail(alert)} sx={{ whiteSpace: 'normal', py: 1.25 }}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" fontWeight={700}>{alert.productName}</Typography>
                    <Chip size="small" color={alert.quantity === 0 ? 'error' : 'warning'} label={alert.quantity === 0 ? 'Out of stock' : 'Low stock'} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">{alert.productCode} · Qty {alert.quantity} / {alert.minimumLevel}</Typography>
                </Box>
              </MuiMenuItem>
            ))}
          </Menu>
      </InventoryPageHeader>

      {/* Tab content */}
      {tab === 'stock' && <StockTab
        t={t}
        filters={filters}
        setFilters={setFilters}
        searchDebounced={searchDebounced}
        handleSearchChange={handleSearchChange}
        quickFilters={filters.stockStatus}
        handleQuickFilter={handleQuickFilter}
        ageingBucket={filters.ageing}
        handleAgeingBucketClick={handleAgeingBucketClick}
        sortField={sortField}
        sortOrder={sortOrder}
        handleSort={handleSort}
        rowsPerPage={rowsPerPage}
        setRowsPerPage={setRowsPerPage}
        handlePageChange={handlePageChange}
        resetFilters={resetFilters}
        openExportMenu={openExportMenu}
        closeExportMenu={closeExportMenu}
        exporting={exporting}
        handleExport={handleExport}
        items={paginatedItems}
        tableItems={tableItems}
        pagination={pagination}
        totalDisplayed={totalDisplayed}
        visibleCount={visibleCount}
        rowsPerPageOptions={PAGE_SIZES}
        state={state}
        columns={columns}
        openDetail={openDetail}
        openEditModal={openEditModal}
        openMovementModal={openMovementModal}
        openCreateModal={openCreateModal}
        openCsvImport={() => setCsvImportOpen(true)}
        openAgeModal={(item) => { setSelectedItem(item); setAgeDialogOpen(true); }}
        openDeleteDialog={(item) => { setSelectedItem(item); setDeleteDialogOpen(true); }}
        userRole={user?.role || ''}
        isMobile={isMobile}
        refreshTabData={refreshTabData}
      />}

      {tab === 'stock-alert' && <StockAlertTab
        t={t}
        state={state}
        alertTypeFilter={alertTypeFilter}
        setAlertTypeFilter={setAlertTypeFilter}
      />}

      {tab === 'order' && <ListTab
        t={t}
        titleKey="inventory.tab.order"
        items={state.orders}
        loading={state.ordersLoading}
        emptyTitle={t('inventory.empty.orders')}
        rowLabel={(item) => item.orderNumber}
        columns={[
          { label: t('inventory.orderNumber'), value: (item: any) => item.orderNumber },
          { label: t('inventory.vendor'), value: (item: any) => item.vendorName },
          { label: t('inventory.orderDate'), value: (item: any) => formatDate(item.orderDate) },
          { label: t('inventory.expectedDelivery'), value: (item: any) => formatDate(item.expectedDelivery) },
          { label: t('inventory.items'), value: (item: any) => item.itemsCount },
          { label: t('inventory.totalAmount'), value: (item: any) => formatCurrency(item.totalAmount) },
          { label: t('inventory.status'), value: (item: any) => <StatusChip label={item.status} colorMap={{ Pending: 'info', 'In Transit': 'warning', Partial: 'warning', Delivered: 'success', Cancelled: 'error' }} /> },
        ]}
      />}

      {tab === 'inward' && <ListTab
        t={t}
        titleKey="inventory.tab.inward"
        items={state.inwardRecords}
        loading={state.inwardLoading}
        emptyTitle={t('inventory.empty.inward')}
        rowLabel={(item) => item.inwardNumber}
        columns={[
          { label: t('inventory.inwardNumber'), value: (item: any) => item.inwardNumber },
          { label: t('inventory.vendor'), value: (item: any) => item.vendorName },
          { label: t('inventory.receivedDate'), value: (item: any) => formatDate(item.receivedDate) },
          { label: t('inventory.invoiceRef'), value: (item: any) => item.invoiceNumber || '—' },
          { label: t('inventory.items'), value: (item: any) => item.itemsCount },
          { label: t('inventory.totalAmount'), value: (item: any) => formatCurrency(item.totalAmount) },
          { label: t('inventory.status'), value: (item: any) => <StatusChip label={item.status} colorMap={{ Pending: 'info', Verified: 'warning', Completed: 'success', Cancelled: 'error' }} /> },
        ]}
      />}

      {tab === 'issued' && <ListTab
        t={t}
        titleKey="inventory.tab.issued"
        items={state.issuedRecords}
        loading={state.issuedLoading}
        emptyTitle={t('inventory.empty.issued')}
        rowLabel={(item) => item.issueNumber}
        columns={[
          { label: t('inventory.issueNumber'), value: (item: any) => item.issueNumber },
          { label: t('inventory.issueDate'), value: (item: any) => formatDate(item.issueDate) },
          { label: t('inventory.issuedTo'), value: (item: any) => item.issuedTo },
          { label: t('inventory.issueType'), value: (item: any) => item.issueType },
          { label: t('inventory.referenceNumber'), value: (item: any) => item.referenceNumber || '—' },
          { label: t('inventory.items'), value: (item: any) => item.itemsCount },
          { label: t('inventory.totalQuantity'), value: (item: any) => item.totalQuantity },
        ]}
      />}

      {tab === 'purchase-return' && <ListTab
        t={t}
        titleKey="inventory.tab.purchaseReturn"
        items={state.purchaseReturns}
        loading={state.returnsLoading}
        emptyTitle={t('inventory.empty.returns')}
        rowLabel={(item) => item.returnNumber}
        columns={[
          { label: t('inventory.returnNumber'), value: (item: any) => item.returnNumber },
          { label: t('inventory.vendor'), value: (item: any) => item.vendorName },
          { label: t('inventory.returnDate'), value: (item: any) => formatDate(item.returnDate) },
          { label: t('inventory.orderRef'), value: (item: any) => item.orderNumber || '—' },
          { label: t('inventory.items'), value: (item: any) => item.itemsCount },
          { label: t('inventory.totalAmount'), value: (item: any) => formatCurrency(item.totalAmount) },
          { label: t('inventory.reason'), value: (item: any) => item.reason || '—' },
          { label: t('inventory.status'), value: (item: any) => <StatusChip label={item.status} colorMap={{ Requested: 'info', Approved: 'warning', Received: 'success', Cancelled: 'error' }} /> },
        ]}
      />}

      {/* Detail modal */}
      <InventoryDetailModal
        t={t}
        open={detailOpen}
        onClose={closeDetail}
        item={state.current ?? selectedItem}
        movementHistory={state.movementHistory}
        loading={state.movementLoading}
        refreshMovementHistory={async (historyFilters) => {
          const productId = (state.current ?? selectedItem)?.id;
          if (productId) await dispatch(fetchStockHistoryThunk({ productId, ...historyFilters })).unwrap();
        }}
      />

      <PartFormDialog
        open={partFormOpen}
        item={selectedItem}
        categories={state.options.categories}
        saving={partFormSaving}
        error={partFormError}
        onClose={() => { setPartFormOpen(false); setSelectedItem(null); }}
        onSave={handlePartSave}
      />

      {/* Movement modal */}
      <MovementModal
        t={t}
        open={movementModalOpen}
        onClose={() => { setMovementModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        form={movementForm}
        setForm={setMovementForm}
        saving={savingMovement}
        onSave={handleMovementSave}
      />

      <Dialog open={ageDialogOpen} onClose={() => setAgeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Part Age</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" fontWeight={700}>{selectedItem?.productName}</Typography>
          <Field label="First stock-in" value={formatDate(selectedItem?.firstStockInDate)} />
          <Box sx={{ mt: 2 }}><Field label="Oldest remaining stock" value={formatDate(selectedItem?.oldestRemainingStockDate)} /></Box>
          <Box sx={{ mt: 2 }}>
            <Chip
              label={`${selectedItem?.oldestRemainingStockDate ? Math.max(0, Math.floor((Date.now() - new Date(selectedItem.oldestRemainingStockDate).getTime()) / 86400000)) : 0} days`}
              color={selectedItem?.oldestRemainingStockDate && (Date.now() - new Date(selectedItem.oldestRemainingStockDate).getTime()) / 86400000 > state.options.agedStockDays ? 'warning' : 'success'}
            />
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setAgeDialogOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Part</DialogTitle>
        <DialogContent dividers><Typography>Delete {selectedItem?.productName}? Stock history will be retained.</Typography></DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <CsvImportDialog open={csvImportOpen} onClose={() => setCsvImportOpen(false)} onImported={refreshInventory} />

      {/* Export menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={closeExportMenu}
        PaperProps={{ sx: { minWidth: 180, mt: 1 } }}
      >
        <MuiMenuItem onClick={() => handleExport('csv')} disabled={exporting}>
          {t('inventory.action.exportCsv')}
        </MuiMenuItem>
        <MuiMenuItem disabled>
          {t('inventory.action.exportExcel')} <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>(coming soon)</Typography>
        </MuiMenuItem>
      </Menu>
    </Box>
  );
}type InventoryTabId = typeof TAB_IDS[number];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------



function StatusChip({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const color = colorMap[label] || 'default';
  return <Chip label={label} size="small" color={color as any} variant="filled" />;
}

// ---------------------------------------------------------------------------
// Stock tab
// ---------------------------------------------------------------------------

function StockTab({
  t,
  filters,
  setFilters,
  searchDebounced,
  handleSearchChange,
  quickFilters,
  handleQuickFilter,
  ageingBucket,
  handleAgeingBucketClick,
  sortField,
  sortOrder,
  handleSort,
  rowsPerPage,
  setRowsPerPage,
  handlePageChange,
  resetFilters,
  openExportMenu,
  closeExportMenu,
  exporting,
  handleExport,
  items,
  tableItems,
  pagination,
  totalDisplayed,
  visibleCount,
  rowsPerPageOptions,
  state,
  columns,
  openDetail,
  openEditModal,
  openMovementModal,
  openCreateModal,
  openCsvImport,
  openAgeModal,
  openDeleteDialog,
  userRole,
  isMobile,
  refreshTabData,
}: {
  t: ReturnType<typeof useT>;
  filters: InventoryFilters;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFilters>>;
  searchDebounced: string;
  handleSearchChange: (v: string) => void;
  quickFilters: string;
  handleQuickFilter: (key: string) => void;
  ageingBucket: string;
  handleAgeingBucketClick: (key: string) => void;
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  handleSort: (field: string, label: string) => void;
  rowsPerPage: number;
  setRowsPerPage: (v: number) => void;
  handlePageChange: (a: unknown, b: number) => void;
  resetFilters: () => void;
  openExportMenu: (e: React.MouseEvent<HTMLElement>) => void;
  closeExportMenu: () => void;
  exporting: boolean;
  handleExport: (format: 'csv' | 'excel') => void;
  items: InventoryItem[];
  tableItems: InventoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totalDisplayed: number;
  visibleCount: number;
  rowsPerPageOptions: number[];
  state: RootState['inventory'];
  columns: typeof COLUMNS;
  openDetail: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
  openMovementModal: (item: InventoryItem, mode: 'add' | 'reduce') => void;
  openCreateModal: () => void;
  openCsvImport: () => void;
  openAgeModal: (item: InventoryItem) => void;
  openDeleteDialog: (item: InventoryItem) => void;
  userRole: string;
  isMobile: boolean;
  refreshTabData: (tab: 'stock') => void;
}) {
  const dispatch = useAppDispatch();
  const locationOptions = ['All Locations', ...state.options.locations];
  const categoryOptions = ['All Categories', ...state.options.categories];
  const canEdit = userRole === 'Admin' || userRole === 'Service Manager';
  const canMoveStock = userRole !== 'Viewer';
  const isAdmin = userRole === 'Admin';
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.vehicleType) chips.push({ key: 'vehicleType', label: `Vehicle: ${filters.vehicleType}`, clear: () => setFilters((f) => ({ ...f, vehicleType: '', page: 1 })) });
    if (filters.partType) chips.push({ key: 'partType', label: `Part Type: ${filters.partType}`, clear: () => setFilters((f) => ({ ...f, partType: '', page: 1 })) });
    if (filters.category) chips.push({ key: 'category', label: `Category: ${filters.category}`, clear: () => setFilters((f) => ({ ...f, category: '', page: 1 })) });
    if (filters.location) chips.push({ key: 'location', label: `Location: ${filters.location}`, clear: () => setFilters((f) => ({ ...f, location: '', page: 1 })) });
    if (filters.stockStatus && filters.stockStatus !== 'all') chips.push({ key: 'stockStatus', label: `Status: ${STATUS_FILTER_LABELS[filters.stockStatus] || filters.stockStatus}`, clear: () => setFilters((f) => ({ ...f, stockStatus: 'all', inStock: undefined, outOfStock: undefined, reorderLevel: undefined, page: 1 })) });
    if (filters.ageing && filters.ageing !== 'all') chips.push({ key: 'ageing', label: `Ageing: ${filters.ageing}`, clear: () => setFilters((f) => ({ ...f, ageing: 'all', page: 1 })) });
    if (filters.minPrice) chips.push({ key: 'minPrice', label: `Min price: ${filters.minPrice}`, clear: () => setFilters((f) => ({ ...f, minPrice: '', page: 1 })) });
    if (filters.maxPrice) chips.push({ key: 'maxPrice', label: `Max price: ${filters.maxPrice}`, clear: () => setFilters((f) => ({ ...f, maxPrice: '', page: 1 })) });
    if (filters.minQty) chips.push({ key: 'minQty', label: `Min qty: ${filters.minQty}`, clear: () => setFilters((f) => ({ ...f, minQty: '', page: 1 })) });
    if (filters.maxQty) chips.push({ key: 'maxQty', label: `Max qty: ${filters.maxQty}`, clear: () => setFilters((f) => ({ ...f, maxQty: '', page: 1 })) });
    return chips;
  }, [filters, setFilters]);

  const filterButtonLabel = activeFilterChips.length === 0 ? 'All' : `Filters (${activeFilterChips.length})`;

  return (
    <Box>
      {/* Summary cards */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              label={t('inventory.kpi.uniqueParts')}
              value={state.stats.uniquePartNos.toLocaleString()}
              icon={<TagIcon fontSize="small" />}
              tint="info.light"
              color="info.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              label={t('inventory.kpi.totalStock')}
              value={state.stats.totalStockItems.toLocaleString()}
              icon={<VehicleIcon fontSize="small" />}
              tint="warning.light"
              color="warning.dark"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              label="Stock Value (Purchase)"
              value={formatCurrency(state.stats.purchaseValue)}
              icon={<RupeeIcon fontSize="small" />}
              tint="success.light"
              color="success.main"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatCard
              label="Stock Value (Sale)"
              value={formatCurrency(state.stats.saleValue)}
              icon={<RupeeIcon fontSize="small" />}
              tint="success.light"
              color="success.main"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Insights */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <InsightsIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={700}>{t('inventory.insights.title')}</Typography>
          </Box>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {AGEING_BUCKETS.map((bucket) => {
                  const isActive = ageingBucket === bucket.key;
                  const count = (bucket.key === 'fresh' ? state.insights.lessThan120Days
                    : bucket.key === 'ageing' ? state.insights.between120And240Days
                    : state.insights.greaterThan240Days);
                  return (
                    <Chip
                      key={bucket.key}
                      label={`${bucket.label}: ${count}`}
                      onClick={() => handleAgeingBucketClick(bucket.key)}
                      clickable
                      color={isActive ? (bucket.color as any) : 'default'}
                      variant={isActive ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 600, cursor: 'pointer', bgcolor: isActive ? (bucket.color === 'success' ? 'success.light' : bucket.color === 'warning' ? 'warning.light' : 'error.light') : 'transparent' }}
                    />
                  );
                })}
                <Chip label={t('inventory.insights.clickHint')} size="small" variant="outlined" sx={{ cursor: 'default', opacity: 0.7 }} />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('inventory.insights.deadStockLabel')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h5" fontWeight={800} sx={{ color: 'error.main' }}>{state.stats.deadStockCount} parts</Typography>
                  <Typography variant="body2" color="text.secondary">{t('inventory.insights.deadStockSub', { value: formatCurrency(state.stats.deadStockValue) })}</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={800} sx={{ color: 'primary.main', mr: 'auto', whiteSpace: 'nowrap' }}>
              Total {pagination.total} Parts
            </Typography>

            <TextField
              size="small"
              placeholder={t('inventory.search.placeholder')}
              value={filters.q}
              onChange={(e) => handleSearchChange(e.target.value)}
              sx={{ width: { xs: '100%', sm: 260 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="outlined"
              startIcon={<FilterIcon fontSize="small" />}
              onClick={(e) => setFilterAnchor(e.currentTarget)}
              sx={{ color: 'text.primary', borderColor: 'divider' }}
            >
              {filterButtonLabel}
            </Button>

            <Button variant="outlined" startIcon={<DownloadIcon fontSize="small" />} onClick={openExportMenu} disabled={exporting} sx={{ color: 'text.primary', borderColor: 'divider' }}>
              Download
            </Button>

            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateModal} disabled={userRole === 'Viewer'}>
              Add New
            </Button>
          </Box>

          {activeFilterChips.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              {activeFilterChips.map((chip) => (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  onDelete={chip.clear}
                  size="small"
                  variant="outlined"
                  sx={{ bgcolor: 'background.subtle', borderColor: 'divider' }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Filter popover (desktop) */}
      <Popover
        open={Boolean(filterAnchor) && !isMobile}
        anchorEl={filterAnchor}
        onClose={() => setFilterAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, p: 2.5, borderRadius: 3, mt: 1 } }}
      >
        <FilterPanel
          t={t}
          filters={filters}
          setFilters={setFilters}
          quickFilters={quickFilters}
          handleQuickFilter={handleQuickFilter}
          resetFilters={resetFilters}
          locationOptions={locationOptions}
          categoryOptions={categoryOptions}
          state={state}
          onClose={() => setFilterAnchor(null)}
        />
      </Popover>

      {/* Filter bottom sheet (mobile) */}
      <Drawer
        anchor="bottom"
        open={Boolean(filterAnchor) && isMobile}
        onClose={() => setFilterAnchor(null)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88vh' } }}
      >
        <Box sx={{ p: 2.5, overflowY: 'auto' }}>
          <FilterPanel
            t={t}
            filters={filters}
            setFilters={setFilters}
            quickFilters={quickFilters}
            handleQuickFilter={handleQuickFilter}
            resetFilters={resetFilters}
            locationOptions={locationOptions}
            categoryOptions={categoryOptions}
            state={state}
            onClose={() => setFilterAnchor(null)}
          />
        </Box>
      </Drawer>

      {/* Table */}
      <Card sx={{ mb: 3 }}>
        {state.error && <MuiAlert severity="error" sx={{ m: 2 }}>{state.error}</MuiAlert>}
        <TableContainer sx={{ maxHeight: { lg: '70vh' }, overflow: 'auto' }}>
          <Table stickyHeader size="small" aria-label={t('inventory.title')} sx={{ minWidth: 1400, '& .MuiTableCell-root': { py: 1.5 } }}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.field}
                    sortDirection={sortField === col.field ? (sortOrder === 'asc' ? 'asc' : 'desc') : false}
                    sx={{
                      cursor: col.sortable ? 'pointer' : 'default',
                      whiteSpace: 'pre-line',
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontWeight: 700,
                      color: 'text.primary',
                      bgcolor: 'background.subtle',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      lineHeight: 1.25,
                    }}
                    align={'numeric' in col && col.numeric ? 'right' : 'left'}
                    onClick={col.sortable ? () => handleSort(col.field, col.label) : undefined}
                    aria-label={col.label}
                  >
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      {HEADER_LABELS[col.field] || col.label}
                      {col.sortable && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'none' }}>
                          {sortField === col.field ? (sortOrder === 'asc' ? t('inventory.common.asc') : t('inventory.common.desc')) : ''}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const ageDays = item.oldestRemainingStockDate
                  ? Math.max(0, Math.floor((Date.now() - new Date(item.oldestRemainingStockDate).getTime()) / 86400000))
                  : 0;

                return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{formatBarcode(item.barcode)}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{item.productName}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{item.productCode}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700}>{item.vehicleType || '—'}</Typography></TableCell>
                    <TableCell align="center"><Typography variant="body2" fontWeight={700}>{item.inventory?.quantity ?? 0}</Typography></TableCell>
                    <TableCell>{item.category || ''}</TableCell>
                    <TableCell>{item.subCategory || ''}</TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700}>{item.inventory?.location || '—'}</Typography></TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main' }}>{formatCurrency(item.pricing?.costPrice ?? 0)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main' }}>{formatCurrency(item.pricing?.sellingPrice ?? 0)}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" color="success" variant="outlined" disabled={!canMoveStock} onClick={() => openMovementModal(item, 'add')} sx={{ minWidth: 0, px: 1.25 }}>Add</Button>
                      <Button size="small" color="primary" variant="outlined" disabled={!canMoveStock || (item.inventory?.quantity ?? 0) === 0} onClick={() => openMovementModal(item, 'reduce')} sx={{ minWidth: 0, px: 1.25, ml: 0.75 }}>Reduce</Button>
                      <Button size="small" variant="outlined" disabled={!canEdit} onClick={() => openEditModal(item)} sx={{ minWidth: 0, px: 1.25, ml: 0.75, color: 'text.secondary', borderColor: 'divider' }}>Edit</Button>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.partType || 'Other'}
                        size="small"
                        sx={item.partType === 'OEM'
                          ? { bgcolor: 'warning.light', color: 'text.primary', fontWeight: 700 }
                          : { bgcolor: 'background.subtle', color: 'text.secondary', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell><Button size="small" variant="contained" onClick={() => openDetail(item)} sx={{ minWidth: 0, px: 1.5 }}>View</Button></TableCell>
                    <TableCell>{item.remark || 'N/A'}</TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700}>{item.employeeName || 'N/A'}</Typography></TableCell>
                    <TableCell>
                      <Button size="small" variant="contained" color={ageDays > state.options.agedStockDays ? 'warning' : 'primary'} onClick={() => openAgeModal(item)} sx={{ minWidth: 0, px: 1.5 }}>View</Button>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        aria-label={`Delete ${item.productName}`}
                        disabled={!isAdmin}
                        onClick={() => openDeleteDialog(item)}
                        sx={{
                          border: 1,
                          borderColor: 'error.main',
                          color: 'error.main',
                          borderRadius: 1.5,
                          p: 0.5,
                          '&:hover': { bgcolor: 'error.light' },
                          '&.Mui-disabled': { borderColor: 'divider', color: 'text.disabled' },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>{t('inventory.empty.title')}</Typography>
                      <Typography variant="body2" color="text.secondary">{t('inventory.empty.sub')}</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalDisplayed}
          page={filters.page - 1}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isFinite(val) || val < 1) return;
            setRowsPerPage(val);
            setFilters((f) => ({ ...f, limit: val, page: 1 }));
          }}
          rowsPerPageOptions={rowsPerPageOptions}
          labelRowsPerPage={t('inventory.common.rowsPerPage')}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            {t('inventory.common.showing', { from: (filters.page - 1) * rowsPerPage + 1, to: Math.min(filters.page * rowsPerPage, tableItems.length), total: tableItems.length })}
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Stock Alert tab
// ---------------------------------------------------------------------------

function StockAlertTab({
  t,
  state,
  alertTypeFilter,
  setAlertTypeFilter,
}: {
  t: ReturnType<typeof useT>;
  state: RootState['inventory'];
  alertTypeFilter: string | null;
  setAlertTypeFilter: (v: string | null) => void;
}) {
  const alerts = state.alerts;
  const filtered = alertTypeFilter ? alerts.filter((a) => a.type === alertTypeFilter) : alerts;

  const typeColors: Record<string, string> = {
    'out-of-stock': 'error',
    'low-stock': 'warning',
    'reorder-level': 'warning',
    'critical': 'error',
  };

  const typeLabels: Record<string, string> = {
    'out-of-stock': t('inventory.alertTypes.outOfStock'),
    'low-stock': t('inventory.alertTypes.lowStock'),
    'reorder-level': t('inventory.alertTypes.reorderLevel'),
    'critical': t('inventory.alertTypes.critical'),
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WarningAmpIcon fontSize="small" sx={{ color: 'error.main' }} />
          <Typography variant="h5" fontWeight={700}>{t('inventory.tab.stockAlert')}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {(['all', 'out-of-stock', 'low-stock', 'reorder-level', 'critical'] as const).map((key) => (
          <Chip
            key={key}
            label={key === 'all' ? t('inventory.filter.all') : typeLabels[key]}
            onClick={() => setAlertTypeFilter(key === 'all' ? null : key)}
            clickable
            color={alertTypeFilter === key ? 'primary' : 'default'}
            variant={alertTypeFilter === key ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, cursor: 'pointer' }}
          />
        ))}
      </Box>

      {state.alertsLoading ? (
        <Card><CardContent sx={{ py: 6 }}><Loader label={t('common.loadingDashboard')} /></CardContent></Card>
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            {filtered.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>{t('inventory.empty.alerts')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('inventory.empty.alertsSub')}</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small" aria-label={t('inventory.tab.stockAlert')}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('inventory.table.partNo')}</TableCell>
                      <TableCell>{t('inventory.table.partName')}</TableCell>
                      <TableCell>{t('inventory.table.category')}</TableCell>
                      <TableCell align="right">{t('inventory.table.qoh')}</TableCell>
                      <TableCell align="right">{t('inventory.table.reorder')}</TableCell>
                      <TableCell>{t('inventory.table.status')}</TableCell>
                      <TableCell>{t('inventory.table.workshop')}</TableCell>
                      <TableCell>{t('inventory.table.lastMovement')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((alert) => (
                      <TableRow key={alert.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{alert.productCode}</Typography>
                        </TableCell>
                        <TableCell>{alert.productName}</TableCell>
                        <TableCell>{alert.category || '—'}</TableCell>
                        <TableCell align="right">{alert.quantity}</TableCell>
                        <TableCell align="right">{alert.minimumLevel}</TableCell>
                        <TableCell>
                          <Chip label={typeLabels[alert.type]} size="small" color={typeColors[alert.type] as any} variant="filled" sx={{ fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{alert.workshopName || '—'}</Typography>
                          <Typography variant="caption" color="text.secondary">{alert.location || '—'}</Typography>
                        </TableCell>
                        <TableCell>{formatDate(alert.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Generic list tab for orders / inward / issued / returns
// ---------------------------------------------------------------------------

function ListTab<T extends Record<string, any>>({
  t,
  titleKey,
  items,
  loading,
  emptyTitle,
  rowLabel,
  columns,
}: {
  t: ReturnType<typeof useT>;
  titleKey: string;
  items: T[];
  loading: boolean;
  emptyTitle: string;
  rowLabel: (item: T) => string;
  columns: { label: string; value: (item: T) => React.ReactNode }[];
}) {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t(titleKey)}</Typography>
      </Box>

      {loading ? (
        <Card><CardContent sx={{ py: 6 }}><Loader label={t('common.loadingDashboard')} /></CardContent></Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>{emptyTitle}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small" aria-label={t(titleKey)}>
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell key={col.label}>{col.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={rowLabel(item)} hover>
                    {columns.map((col) => (
                      <TableCell key={col.label}>{col.value(item)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

function InventoryDetailModal({
  t,
  open,
  onClose,
  item,
  movementHistory,
  loading,
  refreshMovementHistory,
}: {
  t: ReturnType<typeof useT>;
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  movementHistory: StockMovement[];
  loading: boolean;
  refreshMovementHistory: (filters: { type?: string; from?: string; to?: string }) => Promise<void>;
}) {
  const [historyType, setHistoryType] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const status = item ? computeStockStatus(item) : null;
  const ageing = item ? computeAgeingDays(item) : 0;
  const bucket = item ? getAgeingBucket(ageing) : AGEING_BUCKETS[0];

  const taxAmount = item && item.pricing?.sellingPrice ? +(item.pricing.sellingPrice * (item.pricing?.tax ?? 18) / 100).toFixed(2) : 0;
  const value = item && item.inventory ? (item.inventory.quantity) * (item.pricing?.costPrice ?? 0) : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper', px: 3 }}>
        <Typography variant="h6" fontWeight={700}>{t('inventory.detail.title')}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ py: 4 }}><Loader label={t('common.loadingDashboard')} /></Box>
        ) : item ? (
          <Box>
            {/* Part Information */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>{t('inventory.detail.partInfo')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><Field label={t('inventory.table.partNo')} value={item.productCode} mono /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.table.partName')} value={item.productName} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.table.brand')} value={item.brand || t('inventory.common.noData')} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.table.category')} value={item.category || t('inventory.common.noData')} /></Grid>
                <Grid item xs={12} sm={6}><Field label="Barcode" value={item.barcode || t('inventory.common.noData')} mono small /></Grid>
                <Grid item xs={12} sm={6}><Field label="Description" value={item.description || t('inventory.common.noData')} /></Grid>
              </Grid>
            </Box>

            {/* Stock Information */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>{t('inventory.detail.stockInfo')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.quantityOnHand')} value={item.inventory?.quantity ?? 0} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.reorderLevel')} value={item.inventory?.minimumLevel ?? 0} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.stockStatus')} value={<Chip label={STOCK_STATUS_LABELS[status!]} size="small" color={STOCK_STATUS_COLORS[status!]} variant="filled" />} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.rackNumber')} value={item.inventory?.rackNumber || t('inventory.common.noData')} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.workshop')} value={item.inventory?.workshopName || t('inventory.common.noData')} /></Grid>
                <Grid item xs={12} sm={6}><Field label="Location" value={item.inventory?.location || t('inventory.common.noData')} /></Grid>
                <Grid item xs={12} sm={6}><Field label="Unit" value={item.inventory?.unit || t('inventory.common.noData')} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.table.barcode')} value={item.barcode ? formatBarcode(item.barcode) : t('inventory.common.noData')} mono small /></Grid>
              </Grid>
            </Box>

            {/* Pricing */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>{t('inventory.detail.pricing')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.avgPurchasePrice')} value={formatCurrency(item.pricing?.costPrice ?? 0)} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.avgSellingPrice')} value={formatCurrency(item.pricing?.sellingPrice ?? 0)} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.taxType')} value={item.pricing?.tax ? t('inventory.common.taxTypeGst') : t('inventory.common.taxTypeNone')} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.taxPercent')} value={`${item.pricing?.tax ?? 18}%`} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.taxAmount')} value={formatCurrency(taxAmount)} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.table.stockValue')} value={formatCurrency(value)} /></Grid>
              </Grid>
            </Box>

            {/* Ageing */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>{t('inventory.detail.ageing')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.lastPurchaseDate')} value={formatDate(item.lastPurchaseDate)} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.lastMovementDate')} value={formatDate(item.lastMovementDate || item.updatedAt)} /></Grid>
                <Grid item xs={12} sm={6}><Field label={t('inventory.detail.currentAge')} value={<Chip label={`${ageing}d`} size="small" color={bucket.color as any} variant="filled" sx={{ fontWeight: 600 }} />} /></Grid>
              </Grid>
            </Box>

            {/* Movement History */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>{t('inventory.detail.movementHistory')}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <TextField select size="small" label="Type" value={historyType} onChange={(event) => setHistoryType(event.target.value)} sx={{ minWidth: 130 }}>
                  <MenuItem value="">All types</MenuItem>
                  {['Add', 'Reduce', 'Sale', 'Adjustment', 'Inward', 'Issued', 'Purchase Return', 'Opening'].map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                </TextField>
                <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
                <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
                <Button size="small" variant="outlined" onClick={() => refreshMovementHistory({ type: historyType || undefined, from: historyFrom || undefined, to: historyTo || undefined })}>Apply</Button>
              </Box>
              {movementHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('inventory.detail.noMovements')}</Typography>
              ) : (
                <TableContainer sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Qty Change</TableCell>
                        <TableCell align="right">Balance</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell>Employee</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movementHistory.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{formatDateTime(m.recordedAt || m.createdAt)}</TableCell>
                          <TableCell>
                            <Chip label={m.transactionType} size="small" color={(m.quantity > 0 ? 'success' : 'error') as any} variant="filled" />
                          </TableCell>
                          <TableCell align="right">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                          <TableCell align="right">{m.stockAfter}</TableCell>
                          <TableCell align="right">{m.unitPrice == null ? '—' : formatCurrency(m.unitPrice)}</TableCell>
                          <TableCell>{typeof m.recordedBy === 'object' ? (m.recordedBy?.username || m.recordedBy?.email || '—') : '—'}</TableCell>
                          <TableCell>{m.notes || m.reason || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        ) : (
          <Typography color="text.secondary">{t('inventory.empty.title')}</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
// ---------------------------------------------------------------------------
function Field({ label, value, mono = false, small = false }: { label: string; value: React.ReactNode; mono?: boolean; small?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25, display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'monospace' : undefined, fontSize: small ? '0.75rem' : undefined, fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}
// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------

function EditModal({
  t,
  open,
  onClose,
  item,
  form,
  setForm,
  saving,
  onSave,
}: {
  t: ReturnType<typeof useT>;
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  form: { quantity: string; minimumLevel: string; location: string; unit: string };
  setForm: React.Dispatch<React.SetStateAction<{ quantity: string; minimumLevel: string; location: string; unit: string }>>;
  saving: boolean;
  onSave: () => void;
}) {
  const partNo = item?.productCode || '';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper', px: 3 }}>
        <Typography variant="h6" fontWeight={700}>{t('inventory.editModal.title', { partNo })}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.editModal.quantityOnHand')} type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} inputProps={{ min: 0, step: 1 }} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.editModal.reorderLevel')} type="number" value={form.minimumLevel} onChange={(e) => setForm((f) => ({ ...f, minimumLevel: e.target.value }))} inputProps={{ min: 0, step: 1 }} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.editModal.location')} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.editModal.unit')} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('inventory.action.cancel')}</Button>
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? t('action.saving') : t('inventory.action.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
// ---------------------------------------------------------------------------
// Movement modal
// ---------------------------------------------------------------------------

function MovementModal({
  t,
  open,
  onClose,
  item,
  form,
  setForm,
  saving,
  onSave,
}: {
  t: ReturnType<typeof useT>;
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  form: { mode: 'add' | 'reduce'; quantity: string; purchasePrice: string; reason: string; note: string };
  setForm: React.Dispatch<React.SetStateAction<{ mode: 'add' | 'reduce'; quantity: string; purchasePrice: string; reason: string; note: string }>>;
  saving: boolean;
  onSave: () => void;
}) {
  const partNo = item?.productCode || '';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper', px: 3 }}>
        <Typography variant="h6" fontWeight={700}>{form.mode === 'add' ? 'Add Stock' : 'Reduce Stock'} — {partNo}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <TextField required fullWidth size="small" label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} inputProps={{ min: 1, max: form.mode === 'reduce' ? item?.inventory?.quantity : undefined, step: 1 }} helperText={form.mode === 'reduce' ? `Available: ${item?.inventory?.quantity ?? 0}` : undefined} />
          </Grid>
          {form.mode === 'add' && <Grid item xs={12}>
            <TextField fullWidth size="small" label="New Purchase Price (optional)" type="number" value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))} inputProps={{ min: 0, step: '0.01' }} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
          </Grid>}
          {form.mode === 'reduce' && <Grid item xs={12}>
            <TextField required select fullWidth size="small" label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
              <MenuItem value="sale">Sale</MenuItem><MenuItem value="damage">Damage</MenuItem><MenuItem value="return">Return</MenuItem><MenuItem value="correction">Correction</MenuItem>
            </TextField>
          </Grid>}
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} multiline rows={2} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('inventory.action.cancel')}</Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !form.quantity || Number(form.quantity) <= 0 || (form.mode === 'reduce' && !form.reason)}>
          {saving ? t('action.saving') : form.mode === 'add' ? 'Add Stock' : 'Reduce Stock'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
