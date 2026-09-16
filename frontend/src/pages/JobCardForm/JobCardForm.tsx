import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, Grid,
  Divider, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { createJobCard, updateJobCard, fetchJobCard } from '../../redux/jobSlice';
import { showToast } from '../../redux/uiSlice';

const MAKES = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota', 'Kia', 'MG', 'Renault', 'Other'];
const SERVICE_TYPES = ['Maintenance', 'Repair', 'Paint', 'Inspection', 'Alignment', 'Diagnostics', 'Detailing', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];

const initialForm = {
  vehicle: { registrationNumber: '', make: '', model: '', year: '', color: '', fuelType: 'Petrol', odometerReading: '', vin: '' },
  customer: { name: '', email: '', phone: '', alternatePhone: '', address: '' },
  service: { type: 'Maintenance', description: '', priority: 'Medium', estimatedDelivery: '', specialInstructions: '' },
  insurance: { isClaim: false, companyName: '', claimNumber: '', accidentDate: '', accidentDescription: '' },
  corporate: { isCorporate: false, name: '' },
  notes: '',
};

export default function JobCardForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { current } = useAppSelector((state) => state.jobCards);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isEdit) {
      dispatch(fetchJobCard(id));
    }
  }, [isEdit, id, dispatch]);

  useEffect(() => {
    if (isEdit && current) {
      setForm({
        ...initialForm,
        ...current,
        vehicle: { ...initialForm.vehicle, ...current.vehicle, year: current.vehicle?.year || '' },
        customer: { ...initialForm.customer, ...current.customer },
        service: { ...initialForm.service, ...current.service, estimatedDelivery: current.service?.estimatedDelivery?.slice(0, 10) || '' },
        insurance: { ...initialForm.insurance, ...current.insurance, accidentDate: current.insurance?.accidentDate?.slice(0, 10) || '' },
        corporate: { ...initialForm.corporate, ...current.corporate },
      });
    }
  }, [isEdit, current]);

  const set = (section, field, value) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  };

  const handleSubmit = async (e, mode) => {
    e.preventDefault();
    const payload = {
      ...form,
      isDraft: mode === 'draft',
    };
    let res;
    if (isEdit) {
      res = await dispatch(updateJobCard({ id, payload: { service: form.service, insurance: form.insurance, corporate: form.corporate, notes: form.notes } }));
    } else {
      res = await dispatch(createJobCard(payload));
    }
    if (res.type.endsWith('/fulfilled')) {
      dispatch(showToast({ severity: 'success', message: `Job card ${mode === 'draft' ? 'saved as draft' : 'created successfully'}` }));
      const jcId = res.payload?._id || current?._id;
      navigate(`/jobcards/${jcId || ''}` || '/jobcards');
    } else {
      dispatch(showToast({ severity: 'error', message: res.payload || res.error?.message || 'Failed to save job card' }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/jobcards')} size="small">
          Back
        </Button>
        <Typography variant="h5" fontWeight={700}>
          {isEdit ? 'Edit Job Card' : 'Create New Job Card'}
        </Typography>
      </Box>

      <Box component="form" onSubmit={(e) => handleSubmit(e, 'submit')}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>Vehicle Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField fullWidth required label="Registration Number" value={form.vehicle.registrationNumber} onChange={(e) => set('vehicle', 'registrationNumber', e.target.value.toUpperCase())} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField select fullWidth required label="Make" value={form.vehicle.make} onChange={(e) => set('vehicle', 'make', e.target.value)}>
                  {MAKES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth required label="Model" value={form.vehicle.model} onChange={(e) => set('vehicle', 'model', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField select label="Year" required value={form.vehicle.year} onChange={(e) => set('vehicle', 'year', e.target.value)}>
                  {Array.from({ length: 25 }, (_, i) => 2026 - i).map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Color" value={form.vehicle.color} onChange={(e) => set('vehicle', 'color', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField select label="Fuel Type" value={form.vehicle.fuelType} onChange={(e) => set('vehicle', 'fuelType', e.target.value)}>
                  {FUEL_TYPES.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Odometer (km)" required type="number" value={form.vehicle.odometerReading} onChange={(e) => set('vehicle', 'odometerReading', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="VIN / Chassis" value={form.vehicle.vin || ''} onChange={(e) => set('vehicle', 'vin', e.target.value)} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>Customer Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField fullWidth required label="Customer Name" value={form.customer.name} onChange={(e) => set('customer', 'name', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Email" type="email" value={form.customer.email} onChange={(e) => set('customer', 'email', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth required label="Mobile (10-digit)" value={form.customer.phone} onChange={(e) => set('customer', 'phone', e.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Alternate Phone" value={form.customer.alternatePhone} onChange={(e) => set('customer', 'alternatePhone', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" multiline minRows={2} value={form.customer.address} onChange={(e) => set('customer', 'address', e.target.value)} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>Service Details</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField select label="Service Type" value={form.service.type} onChange={(e) => set('service', 'type', e.target.value)}>
                  {SERVICE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField select label="Priority" value={form.service.priority} onChange={(e) => set('service', 'priority', e.target.value)}>
                  {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Estimated Delivery" required type="date" InputLabelProps={{ shrink: true }} value={form.service.estimatedDelivery} onChange={(e) => set('service', 'estimatedDelivery', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Service Description" required value={form.service.description} onChange={(e) => set('service', 'description', e.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Special Instructions / Notes" value={form.service.specialInstructions || ''} onChange={(e) => set('service', 'specialInstructions', e.target.value)} multiline minRows={2} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>Insurance &amp; Corporate</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset">
                  <FormLabel>Insurance Claim</FormLabel>
                  <RadioGroup row value={form.insurance.isClaim ? 'yes' : 'no'} onChange={(e) => set('insurance', 'isClaim', e.target.value === 'yes')}>
                    <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                    <FormControlLabel value="no" control={<Radio />} label="No" />
                  </RadioGroup>
                </FormControl>
              </Grid>
              {form.insurance.isClaim && (
                <>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Insurance Company" value={form.insurance.companyName} onChange={(e) => set('insurance', 'companyName', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Claim Number" value={form.insurance.claimNumber} onChange={(e) => set('insurance', 'claimNumber', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Accident Date" type="date" InputLabelProps={{ shrink: true }} value={form.insurance.accidentDate} onChange={(e) => set('insurance', 'accidentDate', e.target.value)} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Accident Description" value={form.insurance.accidentDescription} onChange={(e) => set('insurance', 'accidentDescription', e.target.value)} multiline minRows={2} />
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel control={<Radio checked={form.corporate.isCorporate} onChange={(e) => set('corporate', 'isCorporate', e.target.checked)} />} label="Corporate / Business Customer" />
              </Grid>
              {form.corporate.isCorporate && (
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Corporate Name" value={form.corporate.name} onChange={(e) => set('corporate', 'name', e.target.value)} />
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button type="submit" variant="contained" color="primary">
            {isEdit ? 'Save Changes' : 'Submit Job Card'}
          </Button>
          {!isEdit && (
            <Button variant="outlined" onClick={(e) => handleSubmit(e, 'draft')}>Save as Draft</Button>
          )}
          <Button variant="text" onClick={() => navigate('/jobcards')}>Cancel</Button>
        </Box>
      </Box>
    </Box>
  );
}