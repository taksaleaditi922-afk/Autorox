import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, TextField, Button, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Chip, Autocomplete, MenuItem, InputAdornment, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import api from '../../services/api';
import Loader from '../../components/Loader';
import { showToast } from '../../redux/uiSlice';
import { useDispatch } from 'react-redux';

const AVAILABILITY = ['Free', 'Busy', 'Away'];

const emptyForm = () => ({
  name: '',
  email: '',
  phone: '',
  specializations: [],
  workingHours: { start: '09:00', end: '18:00' },
  availability: 'Free',
});

export default function Advisors() {
  const dispatch = useDispatch();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignAdvisor, setAssignAdvisor] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [activeJobCards, setActiveJobCards] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);
  const [loadingAssign, setLoadingAssign] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/advisors', { params: { q, active: showInactive ? undefined : 'true' } });
      setData(res.data.data);
    } catch (err) {
      console.error(err);
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Failed to load advisors' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q, showInactive]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      name: a.name || '',
      email: a.email || '',
      phone: a.phone || '',
      specializations: a.specializations || [],
      workingHours: { start: a.workingHours?.start || '09:00', end: a.workingHours?.end || '18:00' },
      availability: a.availability || 'Free',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      dispatch(showToast({ severity: 'warning', message: 'Advisor name is required' }));
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, specializations: form.specializations.filter(Boolean) };
      if (editing) {
        await api.put(`/advisors/${editing._id}`, body);
        dispatch(showToast({ severity: 'success', message: 'Advisor updated' }));
      } else {
        await api.post('/advisors', body);
        dispatch(showToast({ severity: 'success', message: 'Advisor created' }));
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Failed to save advisor' }));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a) => {
    try {
      await api.patch(`/advisors/${a._id}/status`, { isActive: !a.isActive });
      dispatch(showToast({ severity: 'success', message: a.isActive ? 'Advisor deactivated' : 'Advisor activated' }));
      load();
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Update failed' }));
    }
  };

  const openAssign = async (a) => {
    setAssignAdvisor(a);
    setAssignOpen(true);
    setLoadingAssign(true);
    setAssignTarget(null);
    try {
      const [assignedRes, customersRes] = await Promise.all([
        api.get(`/advisors/${a._id}/customers`),
        api.get('/customers', { params: { limit: 100 } }),
      ]);
      setCustomers(assignedRes.data.data.customers || []);
      setActiveJobCards(assignedRes.data.data.activeJobCards || []);
      setAllCustomers(customersRes.data.data || []);
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Failed to load assignment data' }));
    } finally {
      setLoadingAssign(false);
    }
  };

  const assignCustomer = async (customerId) => {
    if (!customerId) return;
    try {
      await api.patch(`/customers/${customerId}/assign-advisor`, {
        advisorId: assignAdvisor._id,
        name: assignAdvisor.name,
      });
      dispatch(showToast({ severity: 'success', message: 'Customer assigned to advisor' }));
      setAssignTarget(null);
      const res = await api.get(`/advisors/${assignAdvisor._id}/customers`);
      setCustomers(res.data.data.customers || []);
      setActiveJobCards(res.data.data.activeJobCards || []);
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Assignment failed' }));
    }
  };

  const removeCustomer = async (customerId) => {
    try {
      await api.patch(`/customers/${customerId}/assign-advisor`, { advisorId: null });
      dispatch(showToast({ severity: 'success', message: 'Customer unassigned' }));
      const res = await api.get(`/advisors/${assignAdvisor._id}/customers`);
      setCustomers(res.data.data.customers || []);
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Update failed' }));
    }
  };

  const unassignedCustomers = allCustomers.filter(
    (c) => !c.assignedAdvisor?.advisorId || c.assignedAdvisor.advisorId === assignAdvisor?._id
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Service Advisors</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Manage advisor availability and workload</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Advisor</Button>
      </Box>

      <Card sx={{ mb: 2, p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email" sx={{ flexGrow: 1, minWidth: 220 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
        />
        <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
        <Button
          startIcon={<GroupIcon />}
          color={showInactive ? 'primary' : 'inherit'}
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? 'Showing all' : 'Show inactive'}
        </Button>
      </Card>

      <Card>
        {loading ? <Loader label="Loading advisors..." /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Specializations</TableCell>
                  <TableCell>Availability</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a._id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.name}</TableCell>
                    <TableCell>{a.email || '—'}</TableCell>
                    <TableCell>{a.phone || '—'}</TableCell>
                    <TableCell>
                      {(a.specializations || []).length ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(a.specializations || []).map((s) => (
                            <Chip key={s} label={s} size="small" variant="outlined" />
                          ))}
                        </Box>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={a.availability || 'Free'}
                        size="small"
                        color={a.availability === 'Busy' ? 'warning' : a.availability === 'Away' ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={a.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={a.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="Assign customers" onClick={() => openAssign(a)}>
                        <GroupIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" title="Edit" onClick={() => openEdit(a)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title={a.isActive ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleActive(a)}
                      >
                        <AssignmentReturnIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">No advisors found.</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Advisor' : 'Add Advisor'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            <Autocomplete
              multiple freeSolo fullWidth
              options={[]}
              value={form.specializations}
              onChange={(e, v) => setForm({ ...form, specializations: v })}
              renderInput={(params) => <TextField {...params} label="Specializations (press Enter)" />}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Start" value={form.workingHours.start} onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, start: e.target.value } })} fullWidth />
              <TextField label="End" value={form.workingHours.end} onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, end: e.target.value } })} fullWidth />
            </Box>
            <TextField
              select fullWidth label="Availability" value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
            >
              {AVAILABILITY.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (editing ? 'Save Changes' : 'Create Advisor')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Assign Customers
          {assignAdvisor && <Typography variant="body2" color="text.secondary">Advisor: {assignAdvisor.name}</Typography>}
        </DialogTitle>
        <DialogContent dividers>
          {loadingAssign ? <Loader label="Loading..." /> : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>Assign a customer</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Autocomplete
                    fullWidth size="small"
                    options={unassignedCustomers}
                    getOptionLabel={(c) => `${c.name}${c.phone ? ` (${c.phone})` : ''}`}
                    value={unassignedCustomers.find((c) => c._id === assignTarget) || null}
                    onChange={(e, v) => setAssignTarget(v?._id || null)}
                    renderInput={(params) => <TextField {...params} label="Select customer" />}
                  />
                  <Button variant="contained" disabled={!assignTarget} onClick={() => assignCustomer(assignTarget)}>
                    Assign
                  </Button>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>Assigned customers ({customers.length})</Typography>
                {customers.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">No customers assigned yet.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Phone</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customers.map((c) => (
                          <TableRow key={c._id} hover>
                            <TableCell>{c.name}</TableCell>
                            <TableCell>{c.phone}</TableCell>
                            <TableCell>{c.email || '—'}</TableCell>
                            <TableCell align="right">
                              <Button size="small" color="error" onClick={() => removeCustomer(c._id)}>Unassign</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>Active job cards ({activeJobCards.length})</Typography>
                {activeJobCards.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">No active job cards for this advisor.</Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Job Card</TableCell>
                          <TableCell>Customer</TableCell>
                          <TableCell>Vehicle</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeJobCards.map((jc) => (
                          <TableRow key={jc._id} hover>
                            <TableCell>{jc.jobCardNumber}</TableCell>
                            <TableCell>{jc.customer?.name || '—'}</TableCell>
                            <TableCell>{jc.vehicle?.registrationNumber || '—'}</TableCell>
                            <TableCell>{jc.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
