// ---------------------------------------------------------------------------
// STEP 1 — Vehicle & Client Details.
//
// Vehicle master / registry lookup, insurance, customer (individual or company),
// identity proof and the service intake (complaint, pickup, advance).
// ---------------------------------------------------------------------------

import {
  Box,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { JobCardStepProps } from '../stepProps';
import {
  BOOKING_SOURCES,
  CUSTOMER_TYPES,
  FUEL_TYPES,
  PAYMENT_MODES,
  PRIORITY_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  VEHICLE_TYPES,
} from '../../../utils/jobCard';

export default function VehicleClientStep({ form, errors, set, setSection }: JobCardStepProps) {
  const err = (path: string) => errors[path] || '';

  return (
    <Box>
      {/* ------------------------------ vehicle ------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Vehicle Details
          </Typography>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={form.vehicleType}
            onChange={(_e, value) => value && set({ vehicleType: value })}
            sx={{ mb: 2 }}
          >
            {VEHICLE_TYPES.map((type) => (
              <ToggleButton key={type} value={type} sx={{ px: 3 }}>
                {type}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                required
                label="Vehicle Number"
                value={form.vehicle.registrationNumber}
                error={Boolean(err('vehicle.registrationNumber'))}
                helperText={err('vehicle.registrationNumber')}
                onChange={(e) => setSection('vehicle', { registrationNumber: e.target.value.toUpperCase() })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Brand"
                value={form.vehicle.brand}
                onChange={(e) => setSection('vehicle', { brand: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Model"
                value={form.vehicle.model}
                onChange={(e) => setSection('vehicle', { model: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Year"
                value={form.vehicle.year}
                error={Boolean(err('vehicle.year'))}
                helperText={err('vehicle.year')}
                onChange={(e) => setSection('vehicle', { year: e.target.value })}
              >
                <MenuItem value="">—</MenuItem>
                {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() + 1 - i).map((y) => (
                  <MenuItem key={y} value={String(y)}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Fuel Type"
                value={form.vehicle.fuelType}
                onChange={(e) => setSection('vehicle', { fuelType: e.target.value })}
              >
                {FUEL_TYPES.map((fuel) => (
                  <MenuItem key={fuel} value={fuel}>
                    {fuel}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                required
                type="number"
                label="Odometer Reading (km)"
                value={form.vehicle.odometer}
                error={Boolean(err('vehicle.odometer'))}
                helperText={err('vehicle.odometer')}
                onChange={(e) => setSection('vehicle', { odometer: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Fuel Meter (%)"
                value={form.vehicle.fuelMeter}
                error={Boolean(err('vehicle.fuelMeter'))}
                helperText={err('vehicle.fuelMeter')}
                onChange={(e) => setSection('vehicle', { fuelMeter: e.target.value })}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Chassis Number"
                value={form.vehicle.chassisNumber}
                onChange={(e) => setSection('vehicle', { chassisNumber: e.target.value.toUpperCase() })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Engine Number"
                value={form.vehicle.engineNumber}
                onChange={(e) => setSection('vehicle', { engineNumber: e.target.value.toUpperCase() })}
              />
            </Grid>
          </Grid>


        </CardContent>
      </Card>

      {/* ---------------------------- insurance ------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Vehicle Insurance Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Insurance Company"
                value={form.insurance.company}
                onChange={(e) => setSection('insurance', { company: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Policy Number"
                value={form.insurance.policyNumber}
                onChange={(e) => setSection('insurance', { policyNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Policy Expiry"
                InputLabelProps={{ shrink: true }}
                value={form.insurance.expiryDate}
                onChange={(e) => setSection('insurance', { expiryDate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Reminder Date"
                InputLabelProps={{ shrink: true }}
                value={form.insurance.reminderDate}
                onChange={(e) => setSection('insurance', { reminderDate: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Insurance Document URL"
                placeholder="Upload via the documents panel, or paste a link"
                value={form.insurance.fileUrl}
                onChange={(e) => setSection('insurance', { fileUrl: e.target.value })}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ----------------------------- customer ------------------------------ */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Customer Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                required
                label="Customer Type"
                value={form.customer.type}
                onChange={(e) => setSection('customer', { type: e.target.value })}
              >
                {CUSTOMER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                required
                label="Customer Name"
                value={form.customer.name}
                error={Boolean(err('customer.name'))}
                helperText={err('customer.name')}
                onChange={(e) => setSection('customer', { name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                required
                label="Phone Number"
                value={form.customer.phone}
                error={Boolean(err('customer.phone'))}
                helperText={err('customer.phone')}
                onChange={(e) => setSection('customer', { phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                required
                type="email"
                label="Email ID"
                value={form.customer.email}
                error={Boolean(err('customer.email'))}
                helperText={err('customer.email')}
                onChange={(e) => setSection('customer', { email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                multiline
                minRows={2}
                label="Full Address"
                value={form.customer.address}
                error={Boolean(err('customer.address'))}
                helperText={err('customer.address')}
                onChange={(e) => setSection('customer', { address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                required={form.customer.type === 'Company'}
                label="GST Number"
                value={form.customer.gstNumber}
                error={Boolean(err('customer.gstNumber'))}
                helperText={err('customer.gstNumber')}
                onChange={(e) => setSection('customer', { gstNumber: e.target.value.toUpperCase() })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Identity Proof Number"
                value={form.customer.idProofNumber}
                onChange={(e) => setSection('customer', { idProofNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Source of Booking"
                value={form.source}
                onChange={(e) => set({ source: e.target.value })}
              >
                {BOOKING_SOURCES.map((source) => (
                  <MenuItem key={source} value={source}>
                    {source}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Identity Proof Document URL"
                value={form.customer.idProofUrl}
                onChange={(e) => setSection('customer', { idProofUrl: e.target.value })}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* --------------------------- service intake -------------------------- */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Service Intake Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Customer Complaint"
                placeholder="e.g. Engine noise, brake failure, AC not cooling"
                value={form.intake.complaint}
                onChange={(e) => setSection('intake', { complaint: e.target.value })}
                inputProps={{ maxLength: 500 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Service Type"
                value={form.serviceType}
                onChange={(e) => set({ serviceType: e.target.value })}
              >
                {SERVICE_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Priority"
                value={form.priority}
                onChange={(e) => set({ priority: e.target.value })}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                label="Estimated Delivery"
                InputLabelProps={{ shrink: true }}
                value={form.estimatedDelivery.date}
                onChange={(e) => set({ estimatedDelivery: { ...form.estimatedDelivery, date: e.target.value } })}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.intake.pickupRequested}
                    onChange={(e) => setSection('intake', { pickupRequested: e.target.checked })}
                  />
                }
                label="Add Pick Up"
              />
            </Grid>
            {form.intake.pickupRequested && (
              <>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Pickup Address"
                    value={form.intake.pickupAddress}
                    error={Boolean(err('intake.pickupAddress'))}
                    helperText={err('intake.pickupAddress')}
                    onChange={(e) => setSection('intake', { pickupAddress: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Pickup Date"
                    InputLabelProps={{ shrink: true }}
                    value={form.intake.pickupDate}
                    onChange={(e) => setSection('intake', { pickupDate: e.target.value })}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Advance Amount"
                value={form.intake.advanceAmount}
                error={Boolean(err('intake.advanceAmount'))}
                helperText={err('intake.advanceAmount')}
                onChange={(e) => setSection('intake', { advanceAmount: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                label="Advance Payment Mode"
                value={form.intake.advancePaymentMode}
                onChange={(e) => setSection('intake', { advancePaymentMode: e.target.value })}
              >
                {PAYMENT_MODES.map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {mode}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Fields marked * are required before you can continue.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
