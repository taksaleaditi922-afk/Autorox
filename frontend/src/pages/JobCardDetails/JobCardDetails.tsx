import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Grid, Divider, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Tooltip, Paper, Chip, Collapse,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import PrintIcon from '@mui/icons-material/Print';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HistoryIcon from '@mui/icons-material/History';
import { fetchJobCard, updateJobStatus, updateJobCard } from '../../redux/jobSlice';
import type { RootState, AppDispatch } from '../../store/store';
import { showToast } from '../../redux/uiSlice';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import Loader from '../../components/Loader';
import { SectionTitle, Row } from '../../components/JobCardDetails/DetailsFields';
import { formatDate, formatDateTime } from '../../utils/format';

const STATUS_OPTIONS = ['New', 'In Progress', 'Pending Parts', 'Pending Approval', 'Ready for Delivery', 'Delivered', 'On Hold', 'Cancelled'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const SERVICE_TYPES = ['Maintenance', 'Repair', 'Paint', 'Inspection', 'Alignment', 'Diagnostics', 'Detailing', 'Other'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];

export default function JobCardDetails() {
  const { id } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { current, loading } = useSelector((state: RootState) => state.jobCards);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [expandedSections, setExpandedSections] = useState({ vehicle: true, customer: true, service: true, insurance: true });

  useEffect(() => {
    dispatch(fetchJobCard(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (current && !editing) {
      setEditForm({
        vehicle: { ...(current.vehicle || {}) },
        customer: { ...(current.customer || {}) },
        service: { ...current.service, estimatedDelivery: current.service?.estimatedDelivery?.slice(0, 10) || '' },
        insurance: { ...current.insurance, accidentDate: current.insurance?.accidentDate?.slice(0, 10) || '' },
        corporate: { ...(current.corporate || {}) },
        notes: current.notes || '',
        advisor: { ...(current.advisor || {}) },
      });
    }
  }, [current, editing]);

  const startEditing = () => {
    if (current) {
      setEditForm({
        vehicle: { ...current.vehicle },
        customer: { ...current.customer },
        service: { ...current.service, estimatedDelivery: current.service?.estimatedDelivery?.slice(0, 10) || '' },
        insurance: { ...current.insurance, accidentDate: current.insurance?.accidentDate?.slice(0, 10) || '' },
        corporate: { ...current.corporate },
        notes: current.notes || '',
        advisor: { ...current.advisor },
      });
      setEditing(true);
    }
  };

  const cancelEditing = () => { setEditing(false); };

  const saveEdit = async () => {
    const payload = {
      vehicle: editForm.vehicle,
      customer: editForm.customer,
      service: { ...editForm.service, estimatedDelivery: editForm.service.estimatedDelivery ? new Date(editForm.service.estimatedDelivery).toISOString() : null },
      insurance: { ...editForm.insurance, accidentDate: editForm.insurance.accidentDate ? new Date(editForm.insurance.accidentDate).toISOString() : null },
      corporate: editForm.corporate,
      notes: editForm.notes,
      advisor: editForm.advisor,
    };
    const res = await dispatch(updateJobCard({ id, payload }));
    if (updateJobCard.fulfilled.match(res)) {
      setEditing(false);
      dispatch(showToast({ severity: 'success', message: 'Job card updated successfully' }));
    } else {
      dispatch(showToast({ severity: 'error', message: res.payload || res.error?.message || 'Failed to update' }));
    }
  };

  const setField = (section, key, value) => {
    setEditForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  };

  const toggleSection = (section) => {
    setExpandedSections((s) => ({ ...s, [section]: !s[section] }));
  };

  const openStatusDialog = () => {
    setNewStatus(current?.status || '');
    setStatusNotes('');
    setStatusDialog(true);
  };

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === current.status) {
      setStatusDialog(false);
      return;
    }
    const res = await dispatch(updateJobStatus({ id, status: newStatus, notes: statusNotes }));
    if (res.type.endsWith('/fulfilled')) {
      dispatch(showToast({ severity: 'success', message: `Status updated to ${newStatus}` }));
      setStatusDialog(false);
    } else {
      const message = res.payload || (res as any).error?.message || 'Failed to update status';
      dispatch(showToast({ severity: 'error', message }));
    }
  };

  const handlePrint = () => window.print();
  if (loading) return <Loader label="Loading job card..." />;
  if (!current) return <Typography color="error">Job card not found.</Typography>;

  const jc = current;
  const timeline = [...(jc.statusHistory || [])].reverse();
  const data = editing ? editForm : jc;

  const SectionHeader = ({ id: sectionId, title, icon, color }: {
    id: string; title: string; icon: ReactNode; color: 'primary' | 'info' | 'warning' | 'error';
  }) => (
    <Box
      onClick={() => toggleSection(sectionId)}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 1.5, px: 2, mb: 1, bgcolor: `${color}.light`, borderRadius: 2, '&:hover': { bgcolor: `${color}.main`, color: 'white', '& .MuiSvgIcon-root': { color: 'white' }, '& .MuiTypography-root': { color: 'white' } }, transition: 'all 0.2s ease' }}
    >
      {icon}
      <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>{title}</Typography>
      <ExpandMoreIcon sx={{ transform: expandedSections[sectionId] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
    </Box>
  );

  const Field = ({ label, value, editing: isEdit, fieldKey, section, type = 'text', options, multiline, sx }: {
    label: string;
    value?: any;
    editing?: boolean;
    fieldKey: string;
    section: string;
    type?: 'text' | 'select' | 'date' | 'number';
    options?: string[];
    multiline?: boolean;
    sx?: object;
  }) => (
    <Box sx={{ mb: 2, ...sx }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.7rem', display: 'block', mb: 0.5 }}>{label}</Typography>
      {isEdit ? (
        type === 'select' ? (
          <TextField select fullWidth size="small" value={value || ''} onChange={(e) => setField(section, fieldKey, e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}>
            {(options || []).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        ) : type === 'date' ? (
          <TextField fullWidth size="small" type="date" InputLabelProps={{ shrink: true }} value={value || ''} onChange={(e) => setField(section, fieldKey, e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }} />
        ) : type === 'number' ? (
          <TextField fullWidth size="small" type="number" value={value || ''} onChange={(e) => setField(section, fieldKey, e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }} />
        ) : (
          <TextField fullWidth size="small" multiline={multiline} minRows={multiline ? 2 : 1} value={value || ''} onChange={(e) => setField(section, fieldKey, e.target.value)} inputProps={fieldKey === 'description' ? { maxLength: 500 } : {}} sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }} />
        )
      ) : (
        <Typography variant="body1" sx={{ fontWeight: 500 }}>{value || '—'}</Typography>
      )}
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/jobcards')} variant="outlined" sx={{ borderRadius: 2.5 }}>Back</Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" fontWeight={800}>{jc.jobCardNumber}</Typography>
          <StatusBadge status={jc.status} />
          <PriorityBadge priority={jc.service?.priority} />
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {editing ? (
          <>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={saveEdit} sx={{ borderRadius: 2.5, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}>Save Changes</Button>
            <Button variant="outlined" startIcon={<CancelIcon />} onClick={cancelEditing} sx={{ borderRadius: 2.5 }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="contained" startIcon={<EditIcon />} onClick={startEditing} sx={{ borderRadius: 2.5 }}>Edit</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ borderRadius: 2.5 }}>Print</Button>
            <Button variant="outlined" color="primary" onClick={openStatusDialog} sx={{ borderRadius: 2.5 }}>Change Status</Button>
          </>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <SectionHeader id="vehicle" title="Vehicle Information" icon={<span style={{ fontSize: 20 }}>🚗</span>} color="primary" />
              {expandedSections.vehicle && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><Field label="Registration Number" value={data.vehicle?.registrationNumber} editing={editing} section="vehicle" fieldKey="registrationNumber" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Make" value={data.vehicle?.make} editing={editing} section="vehicle" fieldKey="make" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Model" value={data.vehicle?.model} editing={editing} section="vehicle" fieldKey="model" /></Grid>
                    <Grid item xs={12} sm={3}><Field label="Year" value={data.vehicle?.year} editing={editing} section="vehicle" fieldKey="year" type="number" /></Grid>
                    <Grid item xs={12} sm={3}><Field label="Color" value={data.vehicle?.color} editing={editing} section="vehicle" fieldKey="color" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Fuel Type" value={data.vehicle?.fuelType} editing={editing} section="vehicle" fieldKey="fuelType" type="select" options={FUEL_TYPES} /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Odometer (km)" value={data.vehicle?.odometerReading} editing={editing} section="vehicle" fieldKey="odometerReading" type="number" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="VIN / Chassis" value={data.vehicle?.vin} editing={editing} section="vehicle" fieldKey="vin" /></Grid>
                  </Grid>
                </Box>
              )}
              <Divider />
              <SectionHeader id="customer" title="Customer Information" icon={<span style={{ fontSize: 20 }}>👤</span>} color="info" />
              {expandedSections.customer && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><Field label="Name" value={data.customer?.name} editing={editing} section="customer" fieldKey="name" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Email" value={data.customer?.email} editing={editing} section="customer" fieldKey="email" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Phone" value={data.customer?.phone} editing={editing} section="customer" fieldKey="phone" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Alternate Phone" value={data.customer?.alternatePhone} editing={editing} section="customer" fieldKey="alternatePhone" /></Grid>
                    <Grid item xs={12}><Field label="Address" value={data.customer?.address} editing={editing} section="customer" fieldKey="address" multiline /></Grid>
                  </Grid>
                </Box>
              )}
              <Divider />
              <SectionHeader id="service" title="Service Details" icon={<span style={{ fontSize: 20 }}>🔧</span>} color="warning" />
              {expandedSections.service && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><Field label="Service Type" value={data.service?.type} editing={editing} section="service" fieldKey="type" type="select" options={SERVICE_TYPES} /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Priority" value={data.service?.priority} editing={editing} section="service" fieldKey="priority" type="select" options={PRIORITY_OPTIONS} /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Estimated Delivery" value={data.service?.estimatedDelivery} editing={editing} section="service" fieldKey="estimatedDelivery" type="date" /></Grid>
                    <Grid item xs={12} sm={6}><Field label="Actual Delivery" value={data.service?.actualDelivery ? formatDateTime(data.service.actualDelivery) : '—'} editing={false} section="service" fieldKey="actualDelivery" /></Grid>
                    <Grid item xs={12}><Field label="Description" value={data.service?.description} editing={editing} section="service" fieldKey="description" multiline /></Grid>
                    <Grid item xs={12}><Field label="Special Instructions" value={data.service?.specialInstructions} editing={editing} section="service" fieldKey="specialInstructions" multiline /></Grid>
                  </Grid>
                </Box>
              )}
              <Divider />
              <SectionHeader id="insurance" title="Insurance &amp; Corporate" icon={<span style={{ fontSize: 20 }}>🛡️</span>} color="error" />
              {expandedSections.insurance && (
                <Box sx={{ px: 2, pb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}><Field label="Insurance Claim" value={data.insurance?.isClaim ? 'Yes' : 'No'} editing={editing} section="insurance" fieldKey="isClaim" /></Grid>
                    {data.insurance?.isClaim && (
                      <>
                        <Grid item xs={12} sm={6}><Field label="Company" value={data.insurance?.companyName} editing={editing} section="insurance" fieldKey="companyName" /></Grid>
                        <Grid item xs={12} sm={6}><Field label="Claim Number" value={data.insurance?.claimNumber} editing={editing} section="insurance" fieldKey="claimNumber" /></Grid>
                        <Grid item xs={12} sm={6}><Field label="Accident Date" value={data.insurance?.accidentDate} editing={editing} section="insurance" fieldKey="accidentDate" type="date" /></Grid>
                        <Grid item xs={12}><Field label="Accident Description" value={data.insurance?.accidentDescription} editing={editing} section="insurance" fieldKey="accidentDescription" multiline /></Grid>
                      </>
                    )}
                    <Grid item xs={12} sm={6}><Field label="Corporate" value={data.corporate?.isCorporate ? 'Yes' : 'No'} editing={editing} section="corporate" fieldKey="isCorporate" /></Grid>
                    {data.corporate?.isCorporate && <Grid item xs={12} sm={6}><Field label="Corporate Name" value={data.corporate?.name} editing={editing} section="corporate" fieldKey="name" /></Grid>}
                  </Grid>
                </Box>
              )}
              <Divider />
              <Box sx={{ px: 2, py: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}><Field label="Assigned Advisor" value={data.advisor?.name || '—'} editing={editing} section="advisor" fieldKey="name" /></Grid>
                  <Grid item xs={12} sm={6}><Field label="Advisor Phone" value={data.advisor?.phone || '—'} editing={editing} section="advisor" fieldKey="phone" /></Grid>
                  <Grid item xs={12}><Field label="Notes" value={data.notes} editing={editing} section="notes" fieldKey="notes" multiline /></Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3, position: 'sticky', top: 80 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HistoryIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Status Timeline</Typography>
              </Box>
              {timeline.length > 0 ? timeline.map((h, i) => (
                <Box key={i} sx={{ mb: 2, pl: 2, borderLeft: '3px solid', borderColor: i === 0 ? 'primary.main' : 'divider', position: 'relative' }}>
                  <Box sx={{ position: 'absolute', left: -7, top: 4, width: 11, height: 11, borderRadius: '50%', bgcolor: i === 0 ? 'primary.main' : 'grey.400', border: '2px solid white' }} />
                  <StatusBadge status={h.status} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 0.5 }}>
                    {formatDateTime(h.changedAt)} · {h.changedBy}
                  </Typography>
                  {h.notes && <Typography variant="body2" sx={{ ml: 0.5, mt: 0.5 }}>{h.notes}</Typography>}
                </Box>
              )) : <Typography variant="body2" color="text.secondary">No history yet</Typography>}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTimeIcon color="secondary" />
                <Typography variant="h6" fontWeight={700}>Audit Trail</Typography>
              </Box>
              {(jc.audit || []).slice(-8).reverse().map((a, i) => (
                <Box key={i} sx={{ mb: 1.5, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main', mt: 0.8, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">{formatDateTime(a.at)} · {a.by}</Typography>
                    <Typography variant="body2" fontWeight={500}>{a.action}</Typography>
                  </Box>
                </Box>
              ))}
              {(!jc.audit || jc.audit.length === 0) && <Typography variant="body2" color="text.secondary">No audit entries</Typography>}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Update Job Card Status</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="New Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} margin="normal">
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Notes / Reason" value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} multiline minRows={2} margin="normal" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStatusChange}>Update Status</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}