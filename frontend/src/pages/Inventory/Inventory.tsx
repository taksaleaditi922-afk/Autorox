import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../utils/useDebounce';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, IconButton,
  Tabs, Tab, Table, TableHead, TableRow, TableBody, TableCell, TableContainer,
  TablePagination, Chip, Tooltip, Menu, MenuItem as MuiMenuItem, Divider,
  InputAdornment, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
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
} from '@mui/icons-material';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import Loader from '../../components/Loader';
import KpiCard from '../../components/Dashboard/KpiCard';
import useT from '../../i18n/useT';
import {
  fetchInventoryList,
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
  resetCurrentItem,
} from '../../redux/inventorySlice';
import {
  INVENTORY_TABS, PAGE_SIZES,
  STOCK_STATUS_LABELS, STOCK_STATUS_COLORS,
  AGEING_BUCKETS,
  COLUMNS,
  computeStockStatus, computeAgeingDays, getAgeingBucket,
  getDefaultFilters,
  formatBarcode, exportToCsv,
} from '../../services/inventoryService';
import type { InventoryFilters, InventoryItem, StockAlert } from '../../services/inventoryService';
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

interface InventoryProps {
  // The page is rendered inside Layout; no extra props.
}

export default function Inventory(props: InventoryProps) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useT();
  const state = useSelector((s) => s.inventory);

  const [tab, setTab] = useState<InventoryTabId>('stock');
  const [filters, setFilters] = useState<InventoryFilters>(getDefaultFilters);
  const [debouncedQuery, setDebouncedQuery] = useState(filters.q);
  const [debouncedPage, setDebouncedPage] = useState(filters.page);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [rowsPerPage, setRowsPerPage] = useState(filters.limit);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [alertTypeFilter, setAlertTypeFilter] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({ quantity: '', minimumLevel: '', location: '', unit: '' });
  const [movementForm, setMovementForm] = useState({
    transactionType: 'Inward',
    quantity: '',
    referenceType: '',
    referenceNumber: '',
    notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Keep page sync'd with filter changes that reset it.
  const pageFromFilter = filters.page;
  const limitFromFilter = filters.limit;

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
        page: debouncedPage,
        limit: rowsPerPage,
        sortField: sortField ?? undefined,
        sortOrder,
      })
    );
  }, [tab, dispatch, searchDebounced, debouncedPage, rowsPerPage, filters.category, filters.brand,
       filters.location, filters.workshopId, filters.stockStatus, filters.ageing,
       filters.minPrice, filters.maxPrice, filters.minQty, filters.maxQty, sortField, sortOrder]);

  // Stats / insights load once per stock visit.
  useEffect(() => {
    if (tab === 'stock') {
      dispatch(fetchInventoryStatsThunk());
      dispatch(fetchInventoryInsightsThunk());
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
    setFilters((f) => ({ ...f, q: value }));
  };

  const handleQuickFilter = (key: string) => {
    if (key === 'all') {
      setFilters((f) => ({ ...f, stockStatus: 'all', inStock: undefined, outOfStock: undefined, reorderLevel: undefined }));
    } else if (key === 'in-stock') {
      setFilters((f) => ({ ...f, stockStatus: 'in-stock', inStock: true, outOfStock: undefined, reorderLevel: undefined }));
    } else if (key === 'out-of-stock') {
      setFilters((f) => ({ ...f, stockStatus: 'out-of-stock', inStock: undefined, outOfStock: true, reorderLevel: undefined }));
    } else if (key === 'reorder-level') {
      setFilters((f) => ({ ...f, stockStatus: 'reorder-level', inStock: undefined, outOfStock: undefined, reorderLevel: true }));
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
      const items = state.items;
      const stats = state.stats;
      const csv = exportToCsv(items, stats);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedItem(null);
    dispatch(resetCurrentItem());
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditForm({
      quantity: String(item.inventory?.quantity ?? 0),
      minimumLevel: String(item.inventory?.minimumLevel ?? 0),
      location: item.inventory?.location ?? '',
      unit: item.inventory?.unit ?? 'Units',
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedItem) return;
    setSavingEdit(true);
    try {
      await dispatch(
        updateStockThunk({
          id: selectedItem.id,
          payload: {
            quantity: editForm.quantity !== '' ? Number(editForm.quantity) : undefined,
            minimumLevel: editForm.minimumLevel !== '' ? Number(editForm.minimumLevel) : undefined,
            location: editForm.location || undefined,
            unit: editForm.unit || undefined,
          },
        })
      ).unwrap();
      setEditModalOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const openMovementModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setMovementForm({ transactionType: 'Inward', quantity: '', referenceType: '', referenceNumber: '', notes: '' });
    setMovementModalOpen(true);
  };

  const handleMovementSave = async () => {
    if (!selectedItem) return;
    const qty = Number(movementForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const sign = movementForm.transactionType === 'Issued' || movementForm.transactionType === 'Purchase Return' ? -1 : 1;
    setSavingMovement(true);
    try {
      await dispatch(
        recordStockMovementThunk({
          productId: selectedItem.id,
          transactionType: movementForm.transactionType,
          quantity: qty * sign,
          reference: movementForm.referenceType || movementForm.referenceNumber
            ? { type: movementForm.referenceType || 'Manual', number: movementForm.referenceNumber || '' }
            : undefined,
          notes: movementForm.notes,
        })
      ).unwrap();
      setMovementModalOpen(false);
      dispatch(
        fetchInventoryList({
          ...filters,
          q: searchDebounced,
          page: filters.page,
          limit: rowsPerPage,
        })
      );
    } finally {
      setSavingMovement(false);
    }
  };

  const columns = useMemo(() => COLUMNS, []);

  const pagination = state.items.length ? state.pagination : { page: 1, limit: rowsPerPage, total: state.items.length, totalPages: 1 };

  // Derive filtered + sorted items for the table row renderer.
  const tableItems = useMemo(() => {
    const list = state.items;
    const q = searchDebounced.trim().toLowerCase();
    let filtered = list.filter((item) => {
      if (!q) return true;
      const haystack =
        `${item.productCode} ${item.productName} ${item.brand || ''} ${item.category || ''} ${item.barcode || ''} ${item.inventory?.location || ''}`.toLowerCase();
      return haystack.includes(q);
    });
    // Apply quick status filters.
    if (filters.stockStatus === 'in-stock') filtered = filtered.filter((i) => computeStockStatus(i) === 'In Stock');
    else if (filters.stockStatus === 'out-of-stock') filtered = filtered.filter((i) => computeStockStatus(i) === 'Out of Stock');
    else if (filters.stockStatus === 'reorder-level') filtered = filtered.filter((i) => computeStockStatus(i) === 'Re-order Level');
    // Apply ageing filter.
    if (filters.ageing === 'fresh') filtered = filtered.filter((i) => getAgeingBucket(computeAgeingDays(i)).key === 'fresh');
    else if (filters.ageing === 'ageing') filtered = filtered.filter((i) => getAgeingBucket(computeAgeingDays(i)).key === 'ageing');
    else if (filters.ageing === 'dead') filtered = filtered.filter((i) => getAgeingBucket(computeAgeingDays(i)).key === 'dead');
    // Apply numeric filters (client-side fallback).
    if (filters.minPrice) {
      const min = Number(filters.minPrice);
      if (Number.isFinite(min)) filtered = filtered.filter((i) => (i.pricing?.costPrice ?? 0) >= min);
    }
    if (filters.maxPrice) {
      const max = Number(filters.maxPrice);
      if (Number.isFinite(max)) filtered = filtered.filter((i) => (i.pricing?.costPrice ?? 0) <= max);
    }
    if (filters.minQty) {
      const min = Number(filters.minQty);
      if (Number.isFinite(min)) filtered = filtered.filter((i) => (i.inventory?.quantity ?? 0) >= min);
    }
    if (filters.maxQty) {
      const max = Number(filters.maxQty);
      if (Number.isFinite(max)) filtered = filtered.filter((i) => (i.inventory?.quantity ?? 0) <= max);
    }
    // Sort.
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const av = getCellValue(a, sortField);
        const bv = getCellValue(b, sortField);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortOrder === 'asc' ? av - bv : bv - av;
        }
        const astr = String(av).toLowerCase();
        const bstr = String(bv).toLowerCase();
        return sortOrder === 'asc' ? astr.localeCompare(bstr) : bstr.localeCompare(astr);
      });
    }
    return filtered;
  }, [state.items, searchDebounced, filters.stockStatus, filters.ageing, filters.minPrice, filters.maxPrice, filters.minQty, filters.maxQty, sortField, sortOrder]);

  const paginatedItems = useMemo(() => {
    const start = (filters.page - 1) * rowsPerPage;
    return tableItems.slice(start, start + rowsPerPage);
  }, [tableItems, filters.page, rowsPerPage]);

  const visibleCount = Math.min(paginatedItems.length, rowsPerPage);
  const totalDisplayed = Math.min(pagination.total, tableItems.length);

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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('inventory.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{t('inventory.subtitle')}</Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={TAB_IDS.indexOf(tab)}
          onChange={handleTabChange}
          sx={{ px: 2, bgcolor: 'background.paper' }}
          aria-label={t('inventory.title')}
        >
          {INVENTORY_TABS.map((item) => (
            <Tab key={item.id} id={item.id} label={t(`inventory.tab.${item.id === 'purchase-return' ? 'purchaseReturn' : item.id === 'stock-alert' ? 'stockAlert' : item.id}`)} />
          ))}
        </Tabs>
      </Card>

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
        refreshMovementHistory={async () => {
          // Real backend would call GET /api/stock-transactions/:productId here.
        }}
      />

      {/* Edit modal */}
      <EditModal
        t={t}
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        form={editForm}
        setForm={setEditForm}
        saving={savingEdit}
        onSave={handleEditSave}
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
  state: ReturnType<typeof useSelector>;
  columns: typeof COLUMNS;
  openDetail: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
  openMovementModal: (item: InventoryItem) => void;
  refreshTabData: (tab: 'stock') => void;
}) {
  const dispatch = useDispatch();
  const workshopOptions = useMemo(() => {
    const set = new Set(state.items.map((i) => i.inventory?.workshopName).filter(Boolean));
    return ['All Workshops', ...Array.from(set)];
  }, [state.items]);
  const locationOptions = useMemo(() => {
    const set = new Set(state.items.map((i) => i.inventory?.location).filter(Boolean));
    return ['All Locations', ...Array.from(set)];
  }, [state.items]);
  const brandOptions = useMemo(() => {
    const set = new Set(state.items.map((i) => i.brand).filter(Boolean));
    return ['All Brands', ...Array.from(set)];
  }, [state.items]);
  const categoryOptions = useMemo(() => {
    const set = new Set(state.items.map((i) => i.category).filter(Boolean));
    return ['All Categories', ...Array.from(set)];
  }, [state.items]);

  return (
    <Box>
      {/* KPI cards */}
      <Box sx={{ mb: 3, animation: 'fadeInUp 0.35s ease-out' }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard
              label={t('inventory.kpi.uniqueParts')}
              value={state.stats.uniquePartNos.toLocaleString()}
              icon={<StockIcon fontSize="small" />}
              color="#0f172a"
              gradient="linear-gradient(135deg, #0f172a 0%, #334155 100%)"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard
              label={t('inventory.kpi.totalStock')}
              value={state.stats.totalStockItems.toLocaleString()}
              sub={t('inventory.kpi.totalStock')}
              icon={<StockIcon fontSize="small" />}
              color="#3b82f6"
              gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard
              label={t('inventory.kpi.stockValue')}
              value={formatCurrency(state.stats.stockValue)}
              icon={<TrendingUpIcon fontSize="small" />}
              color="#10b981"
              gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard
              label={t('inventory.kpi.reorder')}
              value={state.stats.reorderItems}
              icon={<WarningAmpIcon fontSize="small" />}
              color="#f59e0b"
              gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard
              label={t('inventory.kpi.outOfStock')}
              value={state.stats.outOfStock}
              icon={<AlertIcon fontSize="small" />}
              color="#ef4444"
              gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={2}>
            <KpiCard
              label={t('inventory.kpi.deadStockValue')}
              value={formatCurrency(state.stats.deadStockValue)}
              sub={`${state.stats.deadStockCount} ${t('inventory.kpi.deadStockCount')}`}
              icon={<InsightsIcon fontSize="small" />}
              color="#8b5cf6"
              gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
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

      {/* Search + filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              label={t('inventory.search.placeholder')}
              value={filters.q}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('inventory.search.placeholder')}
              sx={{ flexGrow: 1, minWidth: 220 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Quick filters */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(['all', 'in-stock', 'out-of-stock', 'reorder-level'] as const).map((key) => (
                <Chip
                  key={key}
                  label={t(`inventory.filter.${key === 'in-stock' ? 'inStock' : key === 'out-of-stock' ? 'outOfStock' : key === 'reorder-level' ? 'reorder' : 'all'}`)}
                  onClick={() => handleQuickFilter(key)}
                  clickable
                  color={quickFilters === key ? 'primary' : 'default'}
                  variant={quickFilters === key ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                />
              ))}
            </Box>

            <Divider orientation="vertical" flexItem sx={{ alignSelf: 'center', mx: 1 }} />

            <TextField select size="small" label={t('inventory.filter.workshop')} value={filters.workshopId || ''} onChange={(e) => setFilters((f) => ({ ...f, workshopId: e.target.value, location: '' }))} sx={{ minWidth: 170 }}>
              {workshopOptions.map((opt) => <MenuItem key={opt} value={opt === 'All Workshops' ? '' : opt}>{opt}</MenuItem>)}
            </TextField>

            <TextField select size="small" label={t('inventory.filter.location')} value={filters.location || ''} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))} sx={{ minWidth: 170 }}>
              {locationOptions.map((opt) => <MenuItem key={opt} value={opt === 'All Locations' ? '' : opt}>{opt}</MenuItem>)}
            </TextField>

            <TextField select size="small" label={t('inventory.filter.brand')} value={filters.brand || ''} onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))} sx={{ minWidth: 150 }}>
              {brandOptions.map((opt) => <MenuItem key={opt} value={opt === 'All Brands' ? '' : opt}>{opt}</MenuItem>)}
            </TextField>

            <TextField select size="small" label={t('inventory.filter.category')} value={filters.category || ''} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} sx={{ minWidth: 150 }}>
              {categoryOptions.map((opt) => <MenuItem key={opt} value={opt === 'All Categories' ? '' : opt}>{opt}</MenuItem>)}
            </TextField>

            <TextField select size="small" label={t('inventory.filter.status')} value={filters.stockStatus || 'all'} onChange={(e) => setFilters((f) => ({ ...f, stockStatus: e.target.value, inStock: undefined, outOfStock: undefined, reorderLevel: undefined }))} sx={{ minWidth: 150 }}>
              <MenuItem value="all">{t('inventory.filter.allStatuses')}</MenuItem>
              <MenuItem value="fresh">{t('inventory.filter.fresh')}</MenuItem>
              <MenuItem value="ageing">{t('inventory.filter.ageingRange')}</MenuItem>
              <MenuItem value="dead">{t('inventory.filter.dead')}</MenuItem>
            </TextField>

            <TextField select size="small" label={t('inventory.filter.ageing')} value={filters.ageing || 'all'} onChange={(e) => setFilters((f) => ({ ...f, ageing: e.target.value }))} sx={{ minWidth: 160 }}>
              <MenuItem value="all">{t('inventory.filter.all')}</MenuItem>
              <MenuItem value="fresh">{t('inventory.filter.fresh')}</MenuItem>
              <MenuItem value="ageing">{t('inventory.filter.ageingRange')}</MenuItem>
              <MenuItem value="dead">{t('inventory.filter.dead')}</MenuItem>
            </TextField>

            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
              <TextField size="small" type="number" label={t('inventory.filter.priceRange')} value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))} placeholder="Min" sx={{ width: 110 }} />
              <TextField size="small" type="number" label={t('inventory.filter.priceRange')} value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))} placeholder="Max" sx={{ width: 110 }} />
              <TextField size="small" type="number" label={t('inventory.filter.qtyRange')} value={filters.minQty} onChange={(e) => setFilters((f) => ({ ...f, minQty: e.target.value }))} placeholder="Min" sx={{ width: 110 }} />
              <TextField size="small" type="number" label={t('inventory.filter.qtyRange')} value={filters.maxQty} onChange={(e) => setFilters((f) => ({ ...f, maxQty: e.target.value }))} placeholder="Max" sx={{ width: 110 }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <Tooltip title={t('inventory.action.resetFilters')}>
                <IconButton onClick={resetFilters} size="small">
                  <ResetIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon fontSize="small" />} onClick={openExportMenu} disabled={exporting}>
                {t('inventory.action.export')}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ mb: 3 }}>
        <TableContainer>
          <Table size="small" aria-label={t('inventory.title')}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.field}
                    sortDirection={sortField === col.field ? (sortOrder === 'asc' ? 'asc' : 'desc') : false}
                    sx={{ cursor: col.sortable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                    align={col.numeric ? 'right' : 'left'}
                    onClick={col.sortable ? () => handleSort(col.field, col.label) : undefined}
                    aria-label={col.label}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {col.label}
                      {col.sortable && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 700 }}>
                          {sortField === col.field ? (sortOrder === 'asc' ? t('inventory.common.asc') : t('inventory.common.desc')) : ''}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                ))}
                <TableCell align="right">{t('inventory.action.view')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const status = computeStockStatus(item);
                const ageing = computeAgeingDays(item);
                const bucket = getAgeingBucket(ageing);
                const taxAmount = item.pricing?.sellingPrice ? +(item.pricing.sellingPrice * (item.pricing?.tax ?? 18) / 100).toFixed(2) : 0;
                const value = (item.inventory?.quantity ?? 0) * (item.pricing?.costPrice ?? 0);
                const taxTypeLabel = item.pricing?.tax ? t('inventory.common.taxTypeGst') : t('inventory.common.taxTypeNone');

                return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{item.productCode}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.productName}</Typography>
                    </TableCell>
                    <TableCell>{item.brand || '—'}</TableCell>
                    <TableCell>{item.category || '—'}</TableCell>
                    <TableCell align="right">{item.inventory?.quantity ?? 0}</TableCell>
                    <TableCell align="right">{item.inventory?.minimumLevel ?? 0}</TableCell>
                    <TableCell>
                      <Chip label={STOCK_STATUS_LABELS[status]} size="small" color={STOCK_STATUS_COLORS[status]} variant="filled" sx={{ fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(item.pricing?.costPrice ?? 0)}</TableCell>
                    <TableCell align="right">{formatCurrency(item.pricing?.sellingPrice ?? 0)}</TableCell>
                    <TableCell align="right">{item.pricing?.tax ?? 18}%</TableCell>
                    <TableCell align="right">{formatCurrency(taxAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(value)}</TableCell>
                    <TableCell>{item.inventory?.rackNumber || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.inventory?.workshopName || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.inventory?.location || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', letterSpacing: '0.02em' }}>{formatBarcode(item.barcode)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`${ageing}d`} size="small" color={bucket.color as any} variant="filled" sx={{ fontWeight: 600, fontSize: '0.65rem' }} />
                    </TableCell>
                    <TableCell>{formatDate(item.lastPurchaseDate)}</TableCell>
                    <TableCell>{formatDate(item.lastMovementDate || item.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('inventory.action.view')}>
                        <IconButton size="small" onClick={() => openDetail(item)} title={t('inventory.action.view')}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('inventory.action.edit')}>
                        <IconButton size="small" onClick={() => openEditModal(item)} title={t('inventory.action.edit')}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('inventory.action.movement')}>
                        <IconButton size="small" onClick={() => openMovementModal(item)} title={t('inventory.action.movement')}>
                          <StockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 6 }}>
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
  state: ReturnType<typeof useSelector>;
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
  movementHistory: Array<{ id: string; transactionType: string; quantity: number; reference?: { type?: string; number?: string }; stockBefore: number; stockAfter: number; recordedAt: string }>;
  loading: boolean;
  refreshMovementHistory: () => Promise<void>;
}) {
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
              {movementHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('inventory.detail.noMovements')}</Typography>
              ) : (
                <TableContainer sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('inventory.detail.movementHistory')}</TableCell>
                        <TableCell align="right">{t('inventory.table.qoh')}</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>{t('inventory.table.lastMovement')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movementHistory.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Chip label={m.transactionType} size="small" color={(m.quantity > 0 ? 'success' : 'error') as any} variant="filled" />
                          </TableCell>
                          <TableCell align="right">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                          <TableCell>{m.reference?.number || '—'}</TableCell>
                          <TableCell>{formatDateTime(m.recordedAt)}</TableCell>
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

const MOVEMENT_TYPES = [
  { value: 'Inward', labelKey: 'inventory.movementModal.inward' },
  { value: 'Issued', labelKey: 'inventory.movementModal.issued' },
  { value: 'Purchase Return', labelKey: 'inventory.movementModal.purchaseReturn' },
  { value: 'Adjustment', labelKey: 'inventory.movementModal.adjustment' },
];

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
  form: { transactionType: string; quantity: string; referenceType: string; referenceNumber: string; notes: string };
  setForm: React.Dispatch<React.SetStateAction<{ transactionType: string; quantity: string; referenceType: string; referenceNumber: string; notes: string }>>;
  saving: boolean;
  onSave: () => void;
}) {
  const partNo = item?.productCode || '';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper', px: 3 }}>
        <Typography variant="h6" fontWeight={700}>{t('inventory.movementModal.title', { partNo })}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <TextField select fullWidth size="small" label={t('inventory.movementModal.transactionType')} value={form.transactionType} onChange={(e) => setForm((f) => ({ ...f, transactionType: e.target.value }))}>
              {MOVEMENT_TYPES.map((mt) => <MenuItem key={mt.value} value={mt.value}>{t(mt.labelKey)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.movementModal.quantity')} type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} inputProps={{ min: 0, step: 1 }} helperText="Positive qty increases stock; for 'Issued' and 'Purchase Return' the system records the negative movement." />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.movementModal.referenceType')} value={form.referenceType} onChange={(e) => setForm((f) => ({ ...f, referenceType: e.target.value }))} placeholder="e.g. Invoice, Job Card, Manual" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.movementModal.referenceNumber')} value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g. INV-1002" />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label={t('inventory.movementModal.notes')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} multiline rows={2} />
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
