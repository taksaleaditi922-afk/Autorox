import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Collapse,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchInventoryOptionsThunk,
  saveInventoryProductThunk,
} from '../../redux/inventorySlice';
import { showToast } from '../../redux/uiSlice';
import {
  calculateInventoryPriceTotals,
  discountAmountFromPercent,
  discountPercentFromAmount,
  getProfitPerItem,
} from '../../utils/inventoryPriceCalculations';
import type { InventoryPriceTotals } from '../../utils/inventoryPriceCalculations';
import { CATEGORY_SUBCATEGORIES } from './PartFormDialog';
import InventoryPageHeader from './InventoryPageHeader';

function localDateValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const EMPTY_FORM = {
  barcode: '',
  productName: '',
  productCode: '',
  vehicleType: '',
  category: '',
  subCategory: '',
  location: '',
  purchasePrice: '',
  sellingPrice: '',
  openingQuantity: '0',
  partType: '',
  remark: '',
  minimumLevel: '5',
  brand: '',
  model: '',
  variant: '',
  year: '',
  fuelTypes: [] as string[],
  stockDate: localDateValue(),
  unit: 'Units',
  currentQuantity: '0',
  maximumLevel: '',
  purchaseDiscountPercent: '',
  purchaseDiscountAmount: '',
  purchaseTaxType: 'NONE',
  purchaseTaxPercent: '',
  saleDiscountPercent: '',
  saleDiscountAmount: '',
  saleTaxType: 'NONE',
  saleTaxPercent: '',
  managePurchase: false,
  billNumber: '',
  billDate: '',
  vendor: '',
};

type AddPartForm = typeof EMPTY_FORM;
type OutletContext = {
  toggleDrawer?: () => void;
  registerNavigationGuard?: (guard: () => boolean) => () => void;
};

const FUEL_TYPES = ['PETROL', 'EV', 'DIESEL', 'CNG', 'OTHER'];
const UNITS = ['Units', 'Piece', 'Pair', 'Set', 'Box'];
const TAX_RATES = ['0', '5', '12', '18', '28'];
const VEHICLE_YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) =>
  String(new Date().getFullYear() - index),
);
const formatAmount = (value: number) => new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);

function preventInvalidNumberKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
}

interface PriceDetailsCardProps {
  compact?: boolean;
  title: string;
  rateLabel: string;
  rate: string;
  discountPercent: string;
  discountAmount: string;
  taxType: string;
  taxPercent: string;
  totals: InventoryPriceTotals;
  attempted: boolean;
  requiredRate: boolean;
  onRateChange: (value: string) => void;
  onDiscountPercentChange: (value: string) => void;
  onDiscountAmountChange: (value: string) => void;
  onTaxTypeChange: (value: string) => void;
  onTaxPercentChange: (value: string) => void;
}

export function PriceDetailsCard({
  compact = false,
  title,
  rateLabel,
  rate,
  discountPercent,
  discountAmount,
  taxType,
  taxPercent,
  totals,
  attempted,
  requiredRate,
  onRateChange,
  onDiscountPercentChange,
  onDiscountAmountChange,
  onTaxTypeChange,
  onTaxPercentChange,
}: PriceDetailsCardProps) {
  const rateInvalid = requiredRate && (rate === '' || !Number.isFinite(Number(rate)) || Number(rate) < 0);
  const discountPercentInvalid = discountPercent !== '' && (
    !Number.isFinite(Number(discountPercent)) || Number(discountPercent) < 0 || Number(discountPercent) > 100
  );
  const discountAmountInvalid = discountAmount !== '' && (
    !Number.isFinite(Number(discountAmount)) || Number(discountAmount) < 0 ||
    Number(discountAmount) > (Number(rate) || 0)
  );
  const taxRateInvalid = taxType !== 'NONE' && (!taxPercent || !TAX_RATES.includes(taxPercent));
  const labelSx = { minWidth: compact ? 75 : { xs: 92, sm: 145 }, color: 'text.secondary', fontSize: compact ? '0.7rem' : '0.875rem' };
  const smallInputSx = {
    '& .MuiOutlinedInput-root': { height: 42 },
    '& input': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: compact ? 1.5 : { xs: 2, sm: 2.5 } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>{title}</Typography>
        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth required={requiredRate} type="number" label={rateLabel}
              value={rate} onChange={(event) => onRateChange(event.target.value)}
              onKeyDown={preventInvalidNumberKeys}
              inputProps={{ min: 0, step: '0.01', inputMode: 'decimal' }}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              error={attempted && rateInvalid}
              helperText={attempted && rateInvalid ? `${rateLabel} is required and must be non-negative` : undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select fullWidth label="Tax Type" value={taxType}
              onChange={(event) => onTaxTypeChange(event.target.value)}
            >
              <MenuItem value="NONE">None</MenuItem>
              <MenuItem value="GST">GST</MenuItem>
              <MenuItem value="IGST">IGST</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Total &amp; Taxes</Typography>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={labelSx}>Subtotal (Rate × Qty)</Typography>
            <Box
              role="status"
              aria-label={`${title} subtotal, calculated`}
              sx={{
                width: compact ? 110 : { xs: 135, sm: 145 },
                minHeight: 42,
                px: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'action.hover',
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Typography variant="body2" component="span" color="text.secondary">₹</Typography>
              <Typography variant="body2" component="span" fontWeight={600}>{formatAmount(totals.subtotal)}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={labelSx}>Discount (per item)</Typography>
            <Stack direction="row" sx={{ width: compact ? 150 : { xs: 155, sm: 220 }, flexShrink: 0 }}>
              <TextField
                size="small" type="number" value={discountPercent}
                onChange={(event) => onDiscountPercentChange(event.target.value)}
                onKeyDown={preventInvalidNumberKeys}
                inputProps={{ min: 0, max: 100, step: '0.01', inputMode: 'decimal', 'aria-label': `${title} discount percent` }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                error={attempted && discountPercentInvalid}
                helperText={attempted && discountPercentInvalid ? 'Use a discount from 0 to 100%' : undefined}
                sx={{
                  width: '50%',
                  ...smallInputSx,
                  '& .MuiOutlinedInput-root': { height: 42, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                }}
              />
              <TextField
                size="small" type="number" value={discountAmount}
                onChange={(event) => onDiscountAmountChange(event.target.value)}
                onKeyDown={preventInvalidNumberKeys}
                inputProps={{ min: 0, step: '0.01', inputMode: 'decimal', 'aria-label': `${title} discount amount` }}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                error={attempted && discountAmountInvalid}
                helperText={attempted && discountAmountInvalid ? 'Discount cannot exceed the rate' : undefined}
                sx={{
                  width: '50%',
                  ...smallInputSx,
                  '& .MuiOutlinedInput-root': { height: 42, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                }}
              />
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={labelSx}>Tax (%)</Typography>
            <Stack direction="row" sx={{ width: compact ? 150 : { xs: 155, sm: 220 }, flexShrink: 0 }}>
              <TextField
                select size="small" value={taxPercent}
                disabled={!taxType || taxType === 'NONE'}
                onChange={(event) => onTaxPercentChange(event.target.value)}
                SelectProps={{ displayEmpty: true, renderValue: (value) => String(value || 'Rate') }}
                inputProps={{ 'aria-label': `${title} tax percent` }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                error={attempted && taxRateInvalid}
                helperText={attempted && taxRateInvalid ? 'Select a tax rate' : undefined}
                sx={{
                  width: '50%',
                  ...smallInputSx,
                  '& .MuiOutlinedInput-root': { height: 42, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                }}
              >
                <MenuItem value="">Select rate</MenuItem>
                {TAX_RATES.map((value) => <MenuItem key={value} value={value}>{value}%</MenuItem>)}
              </TextField>
              <TextField
                size="small" value={formatAmount(totals.taxAmount)}
                InputProps={{
                  readOnly: true,
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                inputProps={{ 'aria-label': `${title} tax amount` }}
                sx={{
                  width: '50%',
                  ...smallInputSx,
                  '& .MuiOutlinedInput-root': { height: 42, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                }}
              />
            </Stack>
          </Box>

          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ color: 'text.primary' }}>Taxable Amount</Typography>
            <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              ₹ {formatAmount(totals.taxableAmount)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography fontWeight={700} color="accent.main">Total Amount</Typography>
            <TextField
              size="small" value={formatAmount(totals.totalAmount)}
              sx={{
                ...smallInputSx,
                width: compact ? 110 : { xs: 135, sm: 145 },
                '& .MuiOutlinedInput-root': { height: 46, color: 'accent.main', fontWeight: 800 },
              }}
              InputProps={{
                readOnly: true,
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              aria-label={`${title} total amount`}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function generateBarcode() {
  const digits = Array.from(window.crypto.getRandomValues(new Uint8Array(9)), (value) => value % 10);
  const firstTwelve = `890${digits.join('')}`;
  const weightedSum = Array.from(firstTwelve, Number).reduce(
    (sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return `${firstTwelve}${(10 - (weightedSum % 10)) % 10}`;
}

export default function AddPartPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const inventory = useAppSelector((state) => state.inventory);
  const { toggleDrawer, registerNavigationGuard } = useOutletContext<OutletContext>();
  const [form, setForm] = useState<AddPartForm>(EMPTY_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [attemptedPartDetails, setAttemptedPartDetails] = useState(false);
  const [attemptedPriceDetails, setAttemptedPriceDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savedRef = useRef(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...Object.keys(CATEGORY_SUBCATEGORIES), ...inventory.options.categories])).sort(),
    [inventory.options.categories],
  );
  const subCategories = CATEGORY_SUBCATEGORIES[form.category] || (form.subCategory ? [form.subCategory] : []);
  const purchase = Number(form.purchasePrice);
  const selling = Number(form.sellingPrice);
  const quantity = Number(form.currentQuantity);
  const purchaseTotals = calculateInventoryPriceTotals(
    purchase,
    Number.isFinite(quantity) ? quantity : 0,
    Number(form.purchaseDiscountAmount) || 0,
    form.purchaseTaxType === 'NONE' ? 0 : Number(form.purchaseTaxPercent) || 0,
  );
  const saleTotals = calculateInventoryPriceTotals(
    selling,
    Number.isFinite(quantity) ? quantity : 0,
    Number(form.saleDiscountAmount) || 0,
    form.saleTaxType === 'NONE' ? 0 : Number(form.saleTaxPercent) || 0,
  );
  const profitPerItem = getProfitPerItem(
    purchase,
    0,
    selling,
    0,
  );
  const purchaseDiscountValid = Number(form.purchaseDiscountPercent || 0) >= 0 &&
    Number(form.purchaseDiscountPercent || 0) <= 100 &&
    Number(form.purchaseDiscountAmount || 0) >= 0 &&
    Number(form.purchaseDiscountAmount || 0) <= purchase;
  const saleDiscountValid = Number(form.saleDiscountPercent || 0) >= 0 &&
    Number(form.saleDiscountPercent || 0) <= 100 &&
    Number(form.saleDiscountAmount || 0) >= 0 &&
    Number(form.saleDiscountAmount || 0) <= selling;
  const purchaseTaxValid = form.purchaseTaxType === 'NONE' ||
    TAX_RATES.includes(form.purchaseTaxPercent);
  const saleTaxValid = form.saleTaxType === 'NONE' ||
    TAX_RATES.includes(form.saleTaxPercent);
  const missingPartDetails = [
    !form.productCode.trim() ? 'Part Number' : null,
    !form.productName.trim() ? 'Part Name' : null,
    !form.partType ? 'Part Type' : null,
    !form.vehicleType ? 'Vehicle Type' : null,
  ].filter((field): field is string => field !== null);
  const partDetailsValid = Boolean(
    form.productName.trim() && form.productCode.trim() && form.vehicleType && form.partType,
  );
  const priceDetailsValid = form.purchasePrice !== '' && form.sellingPrice !== '' &&
    Number.isFinite(purchase) && purchase >= 0 &&
    Number.isFinite(selling) && selling >= 0 &&
    Number.isFinite(quantity) && quantity >= 0 &&
    Number.isFinite(Number(form.minimumLevel)) && Number(form.minimumLevel) >= 0 &&
    (form.maximumLevel === '' || (Number.isFinite(Number(form.maximumLevel)) && Number(form.maximumLevel) >= 0)) &&
    (form.openingQuantity === '' || Number(form.openingQuantity) === 0) &&
    purchaseDiscountValid && saleDiscountValid && purchaseTaxValid && saleTaxValid;
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);

  useEffect(() => {
    if (inventory.options.categories.length > 0) return;
    dispatch(fetchInventoryOptionsThunk()).unwrap().catch((error: unknown) => {
      dispatch(showToast({
        severity: 'error',
        message: `Unable to load inventory options: ${String(error)}`,
      }));
    });
  }, [dispatch, inventory.options.categories.length]);

  const confirmLeave = useCallback(() => {
    return !isDirty || savedRef.current || window.confirm('Leave Add Part without saving? Your changes will be lost.');
  }, [isDirty]);

  useEffect(() => registerNavigationGuard?.(confirmLeave), [confirmLeave, registerNavigationGuard]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const changeField = (key: keyof AddPartForm, value: string) => {
    savedRef.current = false;
    setForm((current) => ({ ...current, [key]: value }));
    setSaveError('');
  };

  const changePriceField = (key: keyof AddPartForm, value: string) => {
    savedRef.current = false;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'purchasePrice') {
        const rate = Number(value) || 0;
        next.purchaseDiscountAmount = String(discountAmountFromPercent(rate, Number(current.purchaseDiscountPercent) || 0));
      } else if (key === 'sellingPrice') {
        const rate = Number(value) || 0;
        next.saleDiscountAmount = String(discountAmountFromPercent(rate, Number(current.saleDiscountPercent) || 0));
      } else if (key === 'purchaseDiscountPercent') {
        next.purchaseDiscountAmount = String(discountAmountFromPercent(Number(current.purchasePrice) || 0, Number(value) || 0));
      } else if (key === 'purchaseDiscountAmount') {
        next.purchaseDiscountPercent = String(discountPercentFromAmount(Number(current.purchasePrice) || 0, Number(value) || 0));
      } else if (key === 'saleDiscountPercent') {
        next.saleDiscountAmount = String(discountAmountFromPercent(Number(current.sellingPrice) || 0, Number(value) || 0));
      } else if (key === 'saleDiscountAmount') {
        next.saleDiscountPercent = String(discountPercentFromAmount(Number(current.sellingPrice) || 0, Number(value) || 0));
      }
      return next;
    });
    setSaveError('');
  };

  const addStockQuantity = () => {
    const addedQuantity = Number(form.openingQuantity);
    if (!Number.isFinite(addedQuantity) || addedQuantity <= 0) return;
    setForm((current) => ({
      ...current,
      currentQuantity: String((Number(current.currentQuantity) || 0) + addedQuantity),
      openingQuantity: '',
    }));
    savedRef.current = false;
  };

  const toggleFuelType = (fuelType: string) => {
    savedRef.current = false;
    setForm((current) => ({
      ...current,
      fuelTypes: current.fuelTypes.includes(fuelType)
        ? current.fuelTypes.filter((value) => value !== fuelType)
        : [...current.fuelTypes, fuelType],
    }));
  };

  const handleNext = () => {
    setAttemptedPartDetails(true);
    if (partDetailsValid) setCurrentStep(1);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      setCurrentStep(0);
      return;
    }
    navigate('/inventory');
  };

  const handleSave = async () => {
    setAttemptedPriceDetails(true);
    if (!priceDetailsValid) return;

    setSaving(true);
    setSaveError('');
    try {
      await dispatch(saveInventoryProductThunk({
        payload: {
          productCode: form.productCode.trim(),
          productName: form.productName.trim(),
          barcode: form.barcode.trim() || undefined,
          vehicleType: form.vehicleType,
          category: form.category,
          subCategory: form.subCategory,
          partType: form.partType,
          remark: form.remark.trim(),
          pricing: { costPrice: purchase, sellingPrice: selling },
          inventory: {
            quantity: Number(form.currentQuantity) || 0,
            minimumLevel: Number(form.minimumLevel) || 0,
            location: form.location.trim(),
          },
        },
      })).unwrap();
      dispatch(showToast({ severity: 'success', message: 'Part added successfully' }));
      savedRef.current = true;
      setForm(EMPTY_FORM);
      navigate('/inventory');
    } catch (error) {
      const message = String(error || 'Failed to save part');
      setSaveError(message);
      dispatch(showToast({ severity: 'error', message }));
    } finally {
      setSaving(false);
    }
  };

  const sectionTitleSx = { fontWeight: 700, mb: 2 };
  const requiredHelper = (invalid: boolean, message: string) => attemptedPartDetails && invalid ? message : undefined;

  return (
    <Box sx={{ animation: 'fadeInUp 0.35s ease-out', pb: 2 }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: 'background.default', pt: 1, pb: 1 }}>
        <InventoryPageHeader
          title="Add Part"
          avatarLabel={(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
          onMenuClick={toggleDrawer}
        />

        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="breadcrumb"
          sx={{ mb: 1.5 }}
        >
          <Button color="inherit" size="small" onClick={() => navigate('/inventory')}>
            Inventory
          </Button>
          <Typography variant="body2" color="text.primary" fontWeight={600}>Add Part</Typography>
        </Breadcrumbs>

        <Box role="tablist" aria-label="Add part steps" sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
          {['Part Details', 'Price Details'].map((label, index) => {
            const active = currentStep === index;
            const complete = index === 0 && currentStep === 1 && partDetailsValid;
            const locked = index === 1 && !partDetailsValid;
            return (
              <Button
                key={label}
                role="tab"
                aria-selected={active}
                aria-controls={`add-part-step-${index + 1}`}
                disabled={locked || saving}
                onClick={() => {
                  if (index === 0 || partDetailsValid) setCurrentStep(index);
                }}
                startIcon={complete ? <CheckCircleIcon /> : <Avatar sx={{
                  width: 24,
                  height: 24,
                  bgcolor: active ? 'primary.main' : 'background.subtle',
                  color: active ? 'primary.contrastText' : 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>{index + 1}</Avatar>}
                variant={active ? 'contained' : 'outlined'}
                sx={{ flex: { xs: '1 1 145px', sm: 'none' }, minWidth: { xs: 0, sm: 190 }, px: { xs: 1.5, sm: 2.5 }, py: 1.25 }}
              >
                {label}
              </Button>
            );
          })}
        </Box>
        {currentStep === 0 && missingPartDetails.length > 0 && (
          <Typography
            role="status"
            variant="caption"
            color={attemptedPartDetails ? 'error.main' : 'text.secondary'}
            sx={{ display: 'block', textAlign: 'center', mb: 1 }}
          >
            Complete the starred fields ({missingPartDetails.join(', ')}) to unlock Price Details.
          </Typography>
        )}
      </Box>

      {currentStep === 0 ? (
        <Grid container spacing={2} id="add-part-step-1" role="tabpanel" aria-label="Part Details">
          <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
            <Card sx={{ width: '100%', height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" sx={sectionTitleSx}>Part Details</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth required label="Part Number" value={form.productCode}
                      onChange={(event) => changeField('productCode', event.target.value)}
                      error={attemptedPartDetails && !form.productCode.trim()}
                      helperText={requiredHelper(!form.productCode.trim(), 'Part Number is required')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth required label="Part Name" value={form.productName}
                      onChange={(event) => changeField('productName', event.target.value)}
                      error={attemptedPartDetails && !form.productName.trim()}
                      helperText={requiredHelper(!form.productName.trim(), 'Part Name is required')}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select fullWidth required label="Part Type" value={form.partType}
                      onChange={(event) => changeField('partType', event.target.value)}
                      error={attemptedPartDetails && !form.partType}
                      helperText={requiredHelper(!form.partType, 'Part Type is required')}
                    >
                      <MenuItem value="">Select part type</MenuItem>
                      {inventory.options.partTypes.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select fullWidth label="Category" value={form.category}
                      onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, subCategory: '' }))}
                    >
                      <MenuItem value="">None</MenuItem>
                      {categoryOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select fullWidth label="Sub Category" value={form.subCategory}
                      disabled={!form.category}
                      onChange={(event) => changeField('subCategory', event.target.value)}
                    >
                      <MenuItem value="">None</MenuItem>
                      {subCategories.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth multiline minRows={3} label="Remark" value={form.remark}
                      onChange={(event) => changeField('remark', event.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
            <Card sx={{ width: '100%', height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
                    <TextField
                      inputRef={barcodeInputRef}
                      fullWidth
                      label="Bar code"
                      value={form.barcode}
                      onChange={(event) => changeField('barcode', event.target.value)}
                      helperText="Barcode must be unique when supplied"
                      InputProps={{
                        endAdornment: form.barcode ? (
                          <InputAdornment position="end">
                            <Typography variant="caption" color="text.secondary">EAN-13</Typography>
                          </InputAdornment>
                        ) : undefined,
                      }}
                    />
                    <Button
                      variant="text"
                      onClick={() => changeField('barcode', generateBarcode())}
                      startIcon={<AutoAwesomeIcon />}
                      sx={{ minWidth: { sm: 118 }, alignSelf: { xs: 'stretch', sm: 'center' }, whiteSpace: 'nowrap' }}
                    >
                      Auto Generate
                    </Button>
                    <Tooltip title="Focus barcode field for a scanner">
                      <IconButton
                        aria-label="Focus barcode field for scanner"
                        onClick={() => barcodeInputRef.current?.focus()}
                        sx={{ alignSelf: { xs: 'center', sm: 'center' }, border: 1, borderColor: 'divider', borderRadius: 2, width: 48, height: 48 }}
                      >
                        <QrCodeScannerOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="h6" fontWeight={700}>Vehicle Details</Typography>
                    <Stack direction="row" spacing={0.75} role="group" aria-label="Vehicle type">
                      {['4W', '2W'].map((type) => (
                        <Chip
                          key={type}
                          label={type}
                          clickable
                          color={form.vehicleType === type ? 'primary' : 'default'}
                          variant={form.vehicleType === type ? 'filled' : 'outlined'}
                          onClick={() => changeField('vehicleType', type)}
                          aria-pressed={form.vehicleType === type}
                          sx={{
                            minWidth: 58,
                            borderColor: attemptedPartDetails && !form.vehicleType ? 'error.main' : undefined,
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                  {attemptedPartDetails && !form.vehicleType && (
                    <Typography variant="caption" color="error.main" sx={{ mt: '-16px !important' }}>
                      Vehicle Type is required
                    </Typography>
                  )}

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Brand"
                        value={form.brand}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          brand: event.target.value,
                          model: '',
                        }))}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><LocalOfferOutlinedIcon fontSize="small" /></InputAdornment>,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Tooltip title={form.brand ? '' : 'Choose a brand first'}>
                        <span>
                          <TextField
                            fullWidth
                            label="Model"
                            value={form.model}
                            disabled={!form.brand.trim()}
                            onChange={(event) => changeField('model', event.target.value)}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><ShieldOutlinedIcon fontSize="small" /></InputAdornment>,
                            }}
                          />
                        </span>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Variant"
                        value={form.variant}
                        onChange={(event) => changeField('variant', event.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        select
                        fullWidth
                        label="Year"
                        value={form.year}
                        onChange={(event) => changeField('year', event.target.value)}
                        SelectProps={{
                          displayEmpty: true,
                          renderValue: (value) => String(value || 'Select year'),
                        }}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><DirectionsCarOutlinedIcon fontSize="small" /></InputAdornment>,
                        }}
                      >
                        <MenuItem value="">Select year</MenuItem>
                        {VEHICLE_YEARS.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75 }}>
                        Fuel Type
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {FUEL_TYPES.map((fuelType) => {
                          const selected = form.fuelTypes.includes(fuelType);
                          return (
                            <Chip
                              key={fuelType}
                              label={fuelType}
                              clickable
                              aria-pressed={selected}
                              variant={selected ? 'filled' : 'outlined'}
                              onClick={() => toggleFuelType(fuelType)}
                              sx={{
                                minWidth: 72,
                                ...(selected && {
                                  bgcolor: 'accent.main',
                                  color: 'accent.contrastText',
                                  borderColor: 'accent.main',
                                  '&:hover': { bgcolor: 'accent.dark' },
                              }),
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Box id="add-part-step-2" role="tabpanel" aria-label="Price Details">
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card sx={{ width: '100%', height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Stock Entry</Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth type="date" label="Date" value={form.stockDate}
                        onChange={(event) => changeField('stockDate', event.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth label="Employee Name"
                        value={user?.name || user?.email || 'Current user'}
                        InputProps={{
                          readOnly: true,
                          startAdornment: <InputAdornment position="start"><LockOutlinedIcon fontSize="small" /></InputAdornment>,
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover' } }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth required type="number" label="Quantity *"
                        value={form.openingQuantity}
                        onChange={(event) => changeField('openingQuantity', event.target.value)}
                        onKeyDown={preventInvalidNumberKeys}
                        inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                        error={attemptedPriceDetails && form.openingQuantity !== '' && (
                          !Number.isFinite(Number(form.openingQuantity)) ||
                          Number(form.openingQuantity) < 0 ||
                          Number(form.openingQuantity) > 0
                        )}
                        helperText={
                          attemptedPriceDetails && Number(form.openingQuantity) > 0
                            ? 'Select + Add to include this quantity'
                            : attemptedPriceDetails && form.openingQuantity !== '' && Number(form.openingQuantity) < 0
                            ? 'Enter a non-negative quantity'
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        select fullWidth label="Unit" value={form.unit}
                        onChange={(event) => changeField('unit', event.target.value)}
                      >
                        {UNITS.map((unit) => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={3} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Button
                        fullWidth variant="outlined" startIcon={<AddCircleOutlineIcon />}
                        onClick={addStockQuantity}
                        disabled={!Number.isFinite(Number(form.openingQuantity)) || Number(form.openingQuantity) <= 0}
                        sx={{ minHeight: 56 }}
                      >
                        Add
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card sx={{ width: '100%', height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Manage Inventory</Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth label="Rack Number (Location)" value={form.location}
                        onChange={(event) => changeField('location', event.target.value)}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth type="number" label="Current" value={form.currentQuantity}
                        onChange={(event) => changeField('currentQuantity', event.target.value)}
                        onKeyDown={preventInvalidNumberKeys}
                        inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                        error={attemptedPriceDetails && Number(form.currentQuantity) < 0}
                        helperText={attemptedPriceDetails && Number(form.currentQuantity) < 0 ? 'Cannot be negative' : undefined}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth type="number" label="Minimum" value={form.minimumLevel}
                        onChange={(event) => changeField('minimumLevel', event.target.value)}
                        onKeyDown={preventInvalidNumberKeys}
                        inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                        error={attemptedPriceDetails && Number(form.minimumLevel) < 0}
                        helperText={attemptedPriceDetails && Number(form.minimumLevel) < 0 ? 'Cannot be negative' : undefined}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth type="number" label="Maximum" value={form.maximumLevel}
                        onChange={(event) => changeField('maximumLevel', event.target.value)}
                        onKeyDown={preventInvalidNumberKeys}
                        inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                        error={attemptedPriceDetails && form.maximumLevel !== '' && Number(form.maximumLevel) < 0}
                        helperText={attemptedPriceDetails && form.maximumLevel !== '' && Number(form.maximumLevel) < 0 ? 'Cannot be negative' : undefined}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <PriceDetailsCard
                title="Purchase Price Details"
                rateLabel="Purchase Rate"
                rate={form.purchasePrice}
                discountPercent={form.purchaseDiscountPercent}
                discountAmount={form.purchaseDiscountAmount}
                taxType={form.purchaseTaxType}
                taxPercent={form.purchaseTaxPercent}
                totals={purchaseTotals}
                attempted={attemptedPriceDetails}
                requiredRate
                onRateChange={(value) => changePriceField('purchasePrice', value)}
                onDiscountPercentChange={(value) => changePriceField('purchaseDiscountPercent', value)}
                onDiscountAmountChange={(value) => changePriceField('purchaseDiscountAmount', value)}
                onTaxTypeChange={(value) => setForm((current) => ({
                  ...current,
                  purchaseTaxType: value,
                  purchaseTaxPercent: value === 'NONE' ? '' : current.purchaseTaxPercent,
                }))}
                onTaxPercentChange={(value) => changeField('purchaseTaxPercent', value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <PriceDetailsCard
                title="Sale Price Details (per item)"
                rateLabel="Sale Rate *"
                rate={form.sellingPrice}
                discountPercent={form.saleDiscountPercent}
                discountAmount={form.saleDiscountAmount}
                taxType={form.saleTaxType}
                taxPercent={form.saleTaxPercent}
                totals={saleTotals}
                attempted={attemptedPriceDetails}
                requiredRate
                onRateChange={(value) => changePriceField('sellingPrice', value)}
                onDiscountPercentChange={(value) => changePriceField('saleDiscountPercent', value)}
                onDiscountAmountChange={(value) => changePriceField('saleDiscountAmount', value)}
                onTaxTypeChange={(value) => setForm((current) => ({
                  ...current,
                  saleTaxType: value,
                  saleTaxPercent: value === 'NONE' ? '' : current.saleTaxPercent,
                }))}
                onTaxPercentChange={(value) => changeField('saleTaxPercent', value)}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card sx={{ width: '100%', height: '100%' }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                    <Typography variant="h6" fontWeight={700} color="accent.main">Manage Purchase</Typography>
                    <FormControlLabel
                      label=""
                      control={(
                        <Checkbox
                          checked={form.managePurchase}
                          onChange={(event) => setForm((current) => ({ ...current, managePurchase: event.target.checked }))}
                          inputProps={{ 'aria-label': 'Manage purchase' }}
                        />
                      )}
                      sx={{ m: 0 }}
                    />
                  </Box>
                  <Collapse in={form.managePurchase} timeout="auto" unmountOnExit>
                    <Grid container spacing={1.5} sx={{ pt: 1 }}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth label="Bill Number" value={form.billNumber}
                          onChange={(event) => changeField('billNumber', event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth type="date" label="Bill Date" value={form.billDate}
                          onChange={(event) => changeField('billDate', event.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                          <TextField
                            fullWidth label="Vendor" value={form.vendor}
                            onChange={(event) => changeField('vendor', event.target.value)}
                          />
                          <Button disabled startIcon={<AddCircleOutlineIcon />} sx={{ whiteSpace: 'nowrap' }}>
                            Add Vendor
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Collapse>
                  {!form.managePurchase && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Enable Manage Purchase to enter bill and vendor details.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Card sx={{ width: '100%', height: '100%' }}>
                <CardContent sx={{
                  p: { xs: 2, sm: 2.5 },
                  minHeight: 150,
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>Profit &amp; Loss Per Item</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        (Sale Price - Purchase Price)
                      </Typography>
                    </Box>
                    <Typography
                      variant="h5"
                      fontWeight={800}
                      color={profitPerItem > 0 ? 'success.main' : profitPerItem < 0 ? 'error.main' : 'text.secondary'}
                      sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {profitPerItem > 0 ? '+' : profitPerItem < 0 ? '-' : ''}₹{formatAmount(Math.abs(profitPerItem))}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      <Paper
        elevation={2}
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          mt: 3,
          p: { xs: 1.5, sm: 2 },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={saving}
            startIcon={<ChevronLeftIcon />}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Back
          </Button>
          {currentStep === 0 ? (
            <Button variant="contained" onClick={handleNext} endIcon={<AddCircleOutlineIcon />} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Save &amp; Next
            </Button>
          ) : (
            <Tooltip title={!partDetailsValid ? 'Complete required Part Details first' : ''}>
              <span>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving || !partDetailsValid}
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {saving ? 'Saving…' : 'Add'}
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
