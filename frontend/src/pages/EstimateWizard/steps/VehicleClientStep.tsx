// ---------------------------------------------------------------------------
// STEP 1 — Vehicle & Client.
//
// Vehicle type -> vehicle lookup -> vehicle details -> insurance -> compliance
// documents -> customer (CRM) -> identity proof -> pickup request -> booking
// source -> customer complaint.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { showToast } from '../../../redux/uiSlice';
import {
  selectEstimate,
  selectEstimateConfig,
  setBookingSource,
  setComplaint,
  selectCustomer as selectCustomerAction,
  setIdentityDocument,
  setInsuranceDocument,
  updateCustomer,
  updateDocument,
  updateIdentityProof,
  updateInsurance,
  updatePickup,
  updateVehicle,
  setVehicleType,
} from '../../../redux/estimateSlice';
import * as vehicleService from '../../../services/estimate/vehicleService';
import * as customerService from '../../../services/estimate/customerService';
import * as addressService from '../../../services/estimate/addressService';
import { useDebounce } from '../../../utils/useDebounce';
import {
  BOOKING_SOURCES,
  FUEL_TYPES,
  ID_PROOF_TYPES,
  VEHICLE_BRANDS,
  DOCUMENT_STATUS_META,
  getInsuranceStatus,
  getDocumentStatus,
  vehicleYears,
} from '../../../services/estimate/config';
import { maskIdentityNumber } from '../../../utils/estimateValidation';
import type { CustomerSummary } from '../../../services/estimate/types';
import DocumentUploader from '../../../components/estimate/DocumentUploader';
import { InlineAlert, SectionCard, StatusChip } from '../../../components/estimate/primitives';

const COMPLAINT_LIMIT = 2000;

export default function VehicleClientStep() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const estimate = useSelector(selectEstimate);
  const config = useSelector(selectEstimateConfig);
  const errors = estimate.errors || {};

  const [fetching, setFetching] = useState(false);
  const [fetchNotice, setFetchNotice] = useState<{ severity: 'info' | 'warning' | 'success'; message: string } | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState<CustomerSummary['vehicles']>([]);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const debouncedCustomerQuery = useDebounce(customerQuery, 400);
  const abortRef = useRef<AbortController | null>(null);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAllVehicleFields, setShowAllVehicleFields] = useState(false);
  const debouncedAddress = useDebounce(addressQuery, 400);

  const vehicle = estimate.vehicle;
  const customer = estimate.customer;
  const insurance = estimate.insurance;
  const documents = estimate.documents;
  const identityProof = estimate.identityProof;
  const pickup = estimate.pickup;

  const insuranceStatus = useMemo(
    () => getInsuranceStatus(insurance.expiryDate, config.reminderThresholdDays),
    [insurance.expiryDate, config.reminderThresholdDays]
  );

  const isEv = vehicle.fuelType === 'Electric' || vehicle.fuelType === 'Hybrid';

  // ------------------------------------------------------------------ lookup
  const handleFetchVehicle = async () => {
    const reg = vehicleService.normalizeRegistration(vehicle.registrationNumber);
    if (!reg) {
      dispatch(showToast({ severity: 'warning', message: 'Enter a registration number first' }));
      return;
    }
    setFetching(true);
    setFetchNotice(null);
    try {
      const result = await vehicleService.fetchVehicle(reg);
      dispatch(updateVehicle({ ...result.vehicle, registrationNumber: reg }));
      // The service explains itself when it had to fall back; prefer that over
      // a generic message.
      const explanation = result.messages?.find(Boolean);
      if (result.source === 'manual') {
        setFetchNotice({
          severity: 'warning',
          message:
            explanation ||
            'Unable to fetch vehicle details. You can continue by entering the vehicle details manually.',
        });
      } else {
        setFetchNotice({
          severity: 'success',
          message:
            result.source === 'workshop'
              ? 'Vehicle details loaded from your vehicle master.'
              : `Vehicle details fetched. Review and edit anything that looks wrong.${
                  explanation ? ` ${explanation}` : ''
                }`,
        });
        dispatch(showToast({ severity: 'success', message: 'Vehicle details fetched' }));
      }
    } catch (err: any) {
      setFetchNotice({ severity: 'warning', message: err?.message || 'Unable to fetch vehicle details.' });
    } finally {
      setFetching(false);
    }
  };

  // -------------------------------------------------------- customer search
  useEffect(() => {
    const q = debouncedCustomerQuery.trim();
    if (q.length < 2) {
      setCustomerResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearchingCustomers(true);
    setCustomerSearchError(null);

    customerService
      .searchCustomers(q, controller.signal)
      .then((res) => setCustomerResults(res))
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setCustomerResults([]);
        setCustomerSearchError('Customer search is unavailable. You can enter the customer manually.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchingCustomers(false);
      });

    return () => controller.abort();
  }, [debouncedCustomerQuery]);

  // ---------------------------------------------------------- address search
  useEffect(() => {
    const q = debouncedAddress.trim();
    if (q.length < 3 || q === customer.address) {
      setAddressResults([]);
      return;
    }
    let cancelled = false;
    setLoadingAddresses(true);
    addressService
      .search(q)
      .then((res) => {
        if (!cancelled) setAddressResults(res);
      })
      .catch(() => {
        if (!cancelled) setAddressResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAddresses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedAddress, customer.address]);

  const applyCustomer = async (picked: CustomerSummary) => {
    dispatch(
      selectCustomerAction({
        replace: true,
        customer: {
          id: picked.id,
          name: picked.name,
          phone: picked.phone,
          email: picked.email || '',
          address: picked.address || '',
          city: picked.city || '',
          state: picked.state || '',
          pincode: picked.pincode || '',
          gstNumber: picked.gstNumber || '',
        },
      })
    );
    setAddressQuery(picked.address || '');
    dispatch(showToast({ severity: 'success', message: `Loaded ${picked.name} from the customer directory` }));

    const immediate = picked.vehicles?.length ? picked.vehicles : [];
    setCustomerVehicles(immediate);
    if (!immediate.length && picked.id) {
      try {
        const vehicles = await customerService.getCustomerVehicles(picked.id);
        setCustomerVehicles(vehicles);
      } catch {
        /* known vehicles are a convenience, not a requirement */
      }
    }
  };

  const startNewCustomer = () => {
    dispatch(selectCustomerAction({ replace: true, customer: { name: '' } }));
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerVehicles([]);
    dispatch(showToast({ severity: 'info', message: 'Enter the new customer details below' }));
  };

  const fieldError = (path: string) => errors[path];

  return (
    <Box>
      {/* ------------------------------ vehicle type ------------------------------ */}
      <SectionCard
        title="Vehicle Type"
        subtitle="Switching the type adapts the fields below"
        hint="Two-wheelers get their own service catalogue and skip four-wheeler only checks."
      >
        <ToggleButtonGroup
          exclusive
          value={vehicle.type}
          onChange={(_e, value) => value && dispatch(setVehicleType(value))}
          aria-label="Vehicle type"
          sx={{ '& .MuiToggleButton-root': { px: 3, py: 1, gap: 1, fontWeight: 700, borderRadius: '12px !important', border: '1px solid', borderColor: 'divider' } }}
        >
          <ToggleButton value="4W" aria-label="Four wheeler">
            <DirectionsCarIcon fontSize="small" /> 4 Wheeler
          </ToggleButton>
          <ToggleButton value="2W" aria-label="Two wheeler">
            <TwoWheelerIcon fontSize="small" /> 2 Wheeler
          </ToggleButton>
        </ToggleButtonGroup>
      </SectionCard>

      {/* ------------------------------- lookup ---------------------------------- */}
      <SectionCard
        title="Vehicle Identification"
        subtitle="Fetch the vehicle from the registry, or enter the details manually"
        hint="Workshop records are checked first, then the configured registration lookup provider."
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth
              label="Vehicle Registration Number"
              placeholder="MH12AB1234"
              value={vehicle.registrationNumber}
              onChange={(e) => dispatch(updateVehicle({ registrationNumber: e.target.value.toUpperCase() }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleFetchVehicle();
                }
              }}
              error={Boolean(fieldError('vehicle.registrationNumber'))}
              helperText={fieldError('vehicle.registrationNumber')}
              InputProps={{
                sx: { textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' },
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              inputProps={{ 'aria-label': 'Vehicle registration number', autoComplete: 'off' }}
            />
          </Grid>
          <Grid item xs={12} sm={5} sx={{ display: 'flex', alignItems: 'flex-start', pt: { sm: 0.25 } }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleFetchVehicle}
              disabled={fetching}
              startIcon={fetching ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              sx={{ height: 56 }}
            >
              {fetching ? 'Fetching…' : 'Fetch Vehicle'}
            </Button>
          </Grid>
        </Grid>

        {fetchNotice && (
          <Box sx={{ mt: 2 }}>
            <InlineAlert severity={fetchNotice.severity} onClose={() => setFetchNotice(null)}>
              {fetchNotice.message}
            </InlineAlert>
          </Box>
        )}
      </SectionCard>

      {/* ------------------------------- details -------------------------------- */}
      <SectionCard
        title="Vehicle Information"
        subtitle="All fetched values stay editable"
        action={
          isMobile ? (
            <Button size="small" endIcon={<ExpandMoreIcon />} onClick={() => setShowAllVehicleFields((v) => !v)}>
              {showAllVehicleFields ? 'Hide' : 'All fields'}
            </Button>
          ) : undefined
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth select label="Brand" value={vehicle.brand} onChange={(e) => dispatch(updateVehicle({ brand: e.target.value }))} error={Boolean(fieldError('vehicle.brand'))} helperText={fieldError('vehicle.brand')}>
              {VEHICLE_BRANDS.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Model" value={vehicle.model} onChange={(e) => dispatch(updateVehicle({ model: e.target.value }))} error={Boolean(fieldError('vehicle.model'))} helperText={fieldError('vehicle.model')} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Variant" value={vehicle.variant || ''} onChange={(e) => dispatch(updateVehicle({ variant: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth select label="Manufacturing Year" value={vehicle.year ?? ''} onChange={(e) => dispatch(updateVehicle({ year: Number(e.target.value) }))} error={Boolean(fieldError('vehicle.year'))} helperText={fieldError('vehicle.year')}>
              {vehicleYears().map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth select label="Fuel Type" value={vehicle.fuelType || ''} onChange={(e) => dispatch(updateVehicle({ fuelType: e.target.value }))} error={Boolean(fieldError('vehicle.fuelType'))} helperText={fieldError('vehicle.fuelType')}>
              {FUEL_TYPES.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Odometer Reading (km)"
              value={vehicle.odometer ?? ''}
              onChange={(e) => dispatch(updateVehicle({ odometer: e.target.value === '' ? '' : Number(e.target.value) }))}
              error={Boolean(fieldError('vehicle.odometer'))}
              helperText={fieldError('vehicle.odometer')}
              inputProps={{ min: 0 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Fuel Meter (%)"
              value={vehicle.fuelMeter ?? ''}
              onChange={(e) => dispatch(updateVehicle({ fuelMeter: e.target.value === '' ? '' : Number(e.target.value) }))}
              error={Boolean(fieldError('vehicle.fuelMeter'))}
              helperText={fieldError('vehicle.fuelMeter')}
              inputProps={{ min: 0, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Colour" value={vehicle.color || ''} onChange={(e) => dispatch(updateVehicle({ color: e.target.value }))} />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Engine Number" value={vehicle.engineNumber || ''} onChange={(e) => dispatch(updateVehicle({ engineNumber: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Chassis Number" value={vehicle.chassisNumber || ''} onChange={(e) => dispatch(updateVehicle({ chassisNumber: e.target.value }))} />
          </Grid>

          <Collapse in={!isMobile || showAllVehicleFields} sx={{ width: '100%' }}>
            <Grid container spacing={2} sx={{ pt: isMobile && showAllVehicleFields ? 2 : 0, pl: isMobile && showAllVehicleFields ? 2 : 0 }}>
              {isEv && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="EV Battery Capacity"
                      value={vehicle.evBatteryCapacity || ''}
                      onChange={(e) => dispatch(updateVehicle({ evBatteryCapacity: e.target.value }))}
                      placeholder="e.g. 26.8 kWh"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      fullWidth
                      label="EV Charger Type"
                      value={vehicle.evChargerType || ''}
                      onChange={(e) => dispatch(updateVehicle({ evChargerType: e.target.value }))}
                      placeholder="e.g. Type 2 AC / CCS2 DC"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Collapse>
        </Grid>
      </SectionCard>

      {/* ------------------------------ insurance ------------------------------- */}
      <SectionCard
        title="Insurance"
        subtitle="Policy details and document for the claim record"
        action={<StatusChip label={DOCUMENT_STATUS_META[insuranceStatus].label} color={DOCUMENT_STATUS_META[insuranceStatus].color as any} />}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Insurance Company" value={insurance.company} onChange={(e) => dispatch(updateInsurance({ company: e.target.value }))} error={Boolean(fieldError('insurance.company'))} helperText={fieldError('insurance.company')} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Policy Number" value={insurance.policyNumber} onChange={(e) => dispatch(updateInsurance({ policyNumber: e.target.value }))} error={Boolean(fieldError('insurance.policyNumber'))} helperText={fieldError('insurance.policyNumber')} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Policy Start Date"
              InputLabelProps={{ shrink: true }}
              value={insurance.startDate || ''}
              onChange={(e) => dispatch(updateInsurance({ startDate: e.target.value }))}
              error={Boolean(fieldError('insurance.startDate'))}
              helperText={fieldError('insurance.startDate')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Policy Expiry Date"
              InputLabelProps={{ shrink: true }}
              value={insurance.expiryDate || ''}
              onChange={(e) => dispatch(updateInsurance({ expiryDate: e.target.value }))}
              error={Boolean(fieldError('insurance.expiryDate'))}
              helperText={fieldError('insurance.expiryDate')}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Insurance Document
            </Typography>
            <DocumentUploader
              label="Insurance Document"
              document={insurance.document}
              estimateId={estimate.draftId}
              scope="insurance"
              onChange={(doc) => dispatch(setInsuranceDocument(doc))}
            />
          </Grid>
        </Grid>
      </SectionCard>

      {/* ----------------------------- compliance ------------------------------- */}
      <SectionCard
        title="Compliance & Document Expiry"
        subtitle="Track RC, PUC and driving licence validity"
        hint={`Documents expiring within ${config.reminderThresholdDays} days are flagged as expiring soon.`}
      >
        <Stack spacing={2}>
          {(
            [
              { key: 'rc' as const, label: 'RC (Registration Certificate)' },
              { key: 'puc' as const, label: 'PUC (Pollution Certificate)' },
              { key: 'license' as const, label: 'Driving License' },
            ]
          ).map(({ key, label }) => {
            const doc = documents[key];
            const status = getDocumentStatus(doc.expiryDate, config.reminderThresholdDays);
            return (
              <Box
                key={key}
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr auto' },
                  alignItems: 'center',
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2.5,
                }}
              >
                <TextField
                  type="date"
                  label={`${label} — Expiry Date`}
                  InputLabelProps={{ shrink: true }}
                  value={doc.expiryDate || ''}
                  onChange={(e) => dispatch(updateDocument({ key, patch: { expiryDate: e.target.value } }))}
                  error={Boolean(fieldError(`documents.${key}.expiryDate`))}
                  helperText={fieldError(`documents.${key}.expiryDate`) || fieldError(`documents.${key}`)}
                  size="small"
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StatusChip label={DOCUMENT_STATUS_META[status].label} color={DOCUMENT_STATUS_META[status].color as any} />
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={doc.setReminder}
                      onChange={(e) => dispatch(updateDocument({ key, patch: { setReminder: e.target.checked } }))}
                      inputProps={{ 'aria-label': `Set reminder for ${label}` }}
                    />
                  }
                  label="Set Reminder"
                />
              </Box>
            );
          })}
        </Stack>
      </SectionCard>

      {/* ------------------------------- customer ------------------------------ */}
      <SectionCard
        title="Customer Details"
        subtitle="Search the directory or create a new customer"
        action={
          <Button size="small" variant="outlined" startIcon={<PersonAddAltIcon fontSize="small" />} onClick={startNewCustomer}>
            Create New Customer
          </Button>
        }
      >
        <Autocomplete
          freeSolo
          options={customerResults}
          loading={searchingCustomers}
          filterOptions={(options) => options}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.name} · ${option.phone}`)}
          onInputChange={(_e, value, reason) => {
            if (reason === 'input') setCustomerQuery(value);
          }}
          onChange={(_e, value) => {
            if (value && typeof value !== 'string') void applyCustomer(value as CustomerSummary);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search existing customer"
              placeholder="Name, phone or email"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {searchingCustomers ? <CircularProgress size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={(option as CustomerSummary).id}>
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {(option as CustomerSummary).name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(option as CustomerSummary).phone}
                  {(option as CustomerSummary).email ? ` · ${(option as CustomerSummary).email}` : ''}
                </Typography>
              </Box>
            </Box>
          )}
          noOptionsText={customerQuery.trim().length < 2 ? 'Type at least 2 characters' : 'No customers found'}
        />

        {customerSearchError && (
          <Box sx={{ mt: 1.5 }}>
            <InlineAlert severity="warning" onClose={() => setCustomerSearchError(null)}>
              {customerSearchError}
            </InlineAlert>
          </Box>
        )}

        {customerVehicles.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Known vehicles
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 1 }}>
              {customerVehicles.map((v) => (
                <Chip
                  key={v.id}
                  label={`${v.registrationNumber} · ${v.brand} ${v.model}`}
                  onClick={() => {
                    dispatch(
                      updateVehicle({
                        registrationNumber: v.registrationNumber,
                        brand: v.brand,
                        model: v.model,
                        year: v.year ?? '',
                        fuelType: (v.fuelType as any) || '',
                        color: v.color || '',
                        odometer: v.odometer ?? '',
                      })
                    );
                    dispatch(showToast({ severity: 'info', message: `Vehicle ${v.registrationNumber} selected` }));
                  }}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="Customer Name" value={customer.name} onChange={(e) => dispatch(updateCustomer({ name: e.target.value }))} error={Boolean(fieldError('customer.name'))} helperText={fieldError('customer.name')} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Phone Number"
              value={customer.phone}
              onChange={(e) => dispatch(updateCustomer({ phone: e.target.value.replace(/[^\d+\s-]/g, '') }))}
              error={Boolean(fieldError('customer.phone'))}
              helperText={fieldError('customer.phone') || '10-digit mobile number'}
              placeholder="9876543210"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="Email" type="email" value={customer.email || ''} onChange={(e) => dispatch(updateCustomer({ email: e.target.value }))} error={Boolean(fieldError('customer.email'))} helperText={fieldError('customer.email')} />
          </Grid>

          <Grid item xs={12} sm={6} md={6}>
            <Autocomplete
              freeSolo
              options={addressResults}
              loading={loadingAddresses}
              filterOptions={(options) => options}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
              inputValue={customer.address || ''}
              onInputChange={(_e, value, reason) => {
                if (reason === 'input') {
                  dispatch(updateCustomer({ address: value }));
                  setAddressQuery(value);
                } else if (reason === 'reset') {
                  setAddressQuery(value);
                }
              }}
              onChange={(_e, value) => {
                if (value && typeof value !== 'string') {
                  dispatch(
                    updateCustomer({
                      address: value.line1 || value.label,
                      city: value.city,
                      state: value.state,
                      pincode: value.pincode,
                    })
                  );
                  setAddressQuery(value.label);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Address"
                  placeholder="Start typing an area, city or pincode"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingAddresses ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText="Keep typing, or enter the address manually"
            />
            {addressService.isUsingFallbackProvider() && (
              <Typography variant="caption" color="text.muted">
                Using the built-in address suggestions. Manual entry always works.
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="City" value={customer.city || ''} onChange={(e) => dispatch(updateCustomer({ city: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="State" value={customer.state || ''} onChange={(e) => dispatch(updateCustomer({ state: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth label="Pincode" value={customer.pincode || ''} onChange={(e) => dispatch(updateCustomer({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} error={Boolean(fieldError('customer.pincode'))} helperText={fieldError('customer.pincode')} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="GST Number"
              value={customer.gstNumber || ''}
              onChange={(e) => dispatch(updateCustomer({ gstNumber: e.target.value.toUpperCase() }))}
              error={Boolean(fieldError('customer.gstNumber'))}
              helperText={fieldError('customer.gstNumber')}
              inputProps={{ maxLength: 15 }}
            />
          </Grid>
        </Grid>
      </SectionCard>

      {/* --------------------------- identity proof ---------------------------- */}
      <SectionCard
        title="Identity Proof"
        subtitle="Stored securely and only ever shown masked"
        hint="Identity numbers are masked in every API response and on the printed estimate."
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth select label="ID Type" value={identityProof.idType || ''} onChange={(e) => dispatch(updateIdentityProof({ idType: e.target.value }))} error={Boolean(fieldError('identityProof.idType'))} helperText={fieldError('identityProof.idType')}>
              {ID_PROOF_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="ID Number"
              value={identityProof.idNumber || ''}
              onChange={(e) => dispatch(updateIdentityProof({ idNumber: e.target.value.toUpperCase() }))}
              error={Boolean(fieldError('identityProof.idNumber') || fieldError('identityProof'))}
              helperText={
                fieldError('identityProof.idNumber') ||
                fieldError('identityProof') ||
                (identityProof.idNumber ? `Saved as ${maskIdentityNumber(identityProof.idNumber)}` : '')
              }
              inputProps={{ autoComplete: 'off' }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              ID Document
            </Typography>
            <DocumentUploader
              label="ID Document"
              document={identityProof.document}
              estimateId={estimate.draftId}
              scope="identity"
              onChange={(doc) => dispatch(setIdentityDocument(doc))}
            />
          </Grid>
        </Grid>
      </SectionCard>

      {/* ------------------------------ pickup --------------------------------- */}
      <SectionCard title="Pickup Request" subtitle="Arrange collection of the vehicle from the customer">
        <FormControlLabel
          control={
            <Switch
              checked={pickup.enabled}
              onChange={(e) => dispatch(updatePickup({ enabled: e.target.checked }))}
              inputProps={{ 'aria-label': 'Add pick up' }}
            />
          }
          label="Add Pick Up"
        />
        <Collapse in={pickup.enabled}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth multiline minRows={2} label="Pickup Address" value={pickup.address} onChange={(e) => dispatch(updatePickup({ address: e.target.value }))} error={Boolean(fieldError('pickup.address') || fieldError('pickup'))} helperText={fieldError('pickup.address') || fieldError('pickup')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth label="Pickup Contact Person" value={pickup.contactPerson} onChange={(e) => dispatch(updatePickup({ contactPerson: e.target.value }))} error={Boolean(fieldError('pickup.contactPerson'))} helperText={fieldError('pickup.contactPerson')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth label="Pickup Phone" value={pickup.phone} onChange={(e) => dispatch(updatePickup({ phone: e.target.value.replace(/[^\d+\s-]/g, '') }))} error={Boolean(fieldError('pickup.phone'))} helperText={fieldError('pickup.phone')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth type="date" label="Preferred Pickup Date" InputLabelProps={{ shrink: true }} value={pickup.preferredDate} onChange={(e) => dispatch(updatePickup({ preferredDate: e.target.value }))} error={Boolean(fieldError('pickup.preferredDate'))} helperText={fieldError('pickup.preferredDate')} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth type="time" label="Preferred Pickup Time" InputLabelProps={{ shrink: true }} value={pickup.preferredTime} onChange={(e) => dispatch(updatePickup({ preferredTime: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Pickup Notes" value={pickup.notes} onChange={(e) => dispatch(updatePickup({ notes: e.target.value }))} />
            </Grid>
          </Grid>
        </Collapse>
      </SectionCard>

      {/* --------------------------- booking + complaint ----------------------- */}
      <SectionCard title="Booking & Complaint">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth select label="Booking Source" value={estimate.bookingSource} onChange={(e) => dispatch(setBookingSource(e.target.value))}>
              {BOOKING_SOURCES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={4}
              label="Customer Complaint / Reported Issue"
              placeholder="Describe the symptoms the customer reported…"
              value={estimate.complaint}
              onChange={(e) => dispatch(setComplaint(e.target.value.slice(0, COMPLAINT_LIMIT)))}
              inputProps={{ 'aria-label': 'Customer complaint', maxLength: COMPLAINT_LIMIT }}
              FormHelperTextProps={{ sx: { display: 'flex', justifyContent: 'flex-end', mx: 0 } }}
              helperText={`${estimate.complaint.length}/${COMPLAINT_LIMIT}`}
            />
          </Grid>
        </Grid>
      </SectionCard>
    </Box>
  );
}
