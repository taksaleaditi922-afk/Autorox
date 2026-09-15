import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useDispatch } from 'react-redux';
import api from '../../services/api';
import Loader from '../../components/Loader';
import { formatDate, formatCurrency } from '../../utils/format';
import { showToast } from '../../redux/uiSlice';

const EMPTY_FORM = {
  jobCardId: '',
  items: { parts: [], labor: [], other: [] },
  discount: { type: 'Fixed', value: 0, reason: '' },
  tax: { rate: 18 },
  notes: '',
  terms: '',
};

export default function Estimates() {
  const dispatch = useDispatch();
  const [data, setData] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = async () => {
    setLoading(true);
    try {
      const [estRes, jcRes] = await Promise.all([
        api.get('/estimates'),
        api.get('/jobcards', { params: { limit: 100 } }),
      ]);
      setData(estRes.data.data);
      setJobCards(jcRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setPart = (i, key, value) => {
    const parts = [...(form.items.parts || [])];
    parts[i] = { ...parts[i], [key]: value };
    setForm((f) => ({ ...f, items: { ...f.items, parts } }));
  };

  const computeTotals = () => {
    const partsTotal = (form.items.parts || []).reduce((s, p) => s + (p.quantity || 0) * (p.unitCost || 0), 0);
    const discountValue = form.discount?.type === 'Percentage'
      ? (partsTotal * (form.discount?.value || 0)) / 100
      : (form.discount?.value || 0);
    const taxable = Math.max(partsTotal - discountValue, 0);
    const tax = (taxable * (form.tax?.rate || 0)) / 100;
    return { partsTotal, discountValue, taxable, tax, total: taxable + tax };
  };

  const handleSave = async (status) => {
    const payload = {
      jobCardId: form.jobCardId,
      status,
      items: {
        parts: (form.items.parts || []).map((p) => ({ ...p, totalCost: (p.quantity || 0) * (p.unitCost || 0) })),
        labor: (form.items.labor || []),
        other: (form.items.other || []),
      },
      discount: form.discount,
      tax: form.tax,
      notes: form.notes,
      terms: form.terms,
    };
    try {
      await api.post('/estimates', payload);
      dispatch(showToast({ severity: 'success', message: `Estimate ${status === 'Draft' ? 'saved as draft' : 'submitted'}` }));
      setDialog(false);
      load();
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || 'Failed to save estimate' }));
    }
  };

  const totals = computeTotals();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Estimates</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Create and manage service cost estimates</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog(true)}>New Estimate</Button>
      </Box>

      <Card>
        {loading ? <Loader label="Loading estimates..." /> : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Estimate #</TableCell><TableCell>Job Card</TableCell>
                  <TableCell>Status</TableCell><TableCell align="right">Grand Total</TableCell>
                  <TableCell>Valid Until</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e._id} hover>
                    <TableCell>{e.estimateNumber}</TableCell>
                    <TableCell>{e.jobCardId?.jobCardNumber || '—'}</TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell align="right">{formatCurrency(e.grandTotal)}</TableCell>
                    <TableCell>{formatDate(e.validUntil)}</TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}><Typography variant="body2" color="text.secondary">No estimates found.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={dialog} onClose={() => setDialog(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Estimate</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Job Card" value={form.jobCardId || ''} onChange={(e) => setForm((f) => ({ ...f, jobCardId: e.target.value }))} margin="normal">
            {jobCards.map((jc) => <MenuItem key={jc._id} value={jc._id}>{jc.jobCardNumber} · {jc.vehicle?.registrationNumber}</MenuItem>)}
          </TextField>

          <Typography variant="subtitle1" fontWeight={600} mt={2}>Parts</Typography>
          {(form.items.parts || []).map((p, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <TextField size="small" label="Part" sx={{ flex: 2, minWidth: 140 }} value={p.name || ''} onChange={(e) => setPart(i, 'name', e.target.value)} />
              <TextField size="small" label="Qty" type="number" sx={{ width: 70 }} value={p.quantity || ''} onChange={(e) => setPart(i, 'quantity', e.target.value)} />
              <TextField size="small" label="Unit Cost" type="number" sx={{ width: 110 }} value={p.unitCost || ''} onChange={(e) => setPart(i, 'unitCost', e.target.value)} />
              <Typography sx={{ alignSelf: 'center' }}>= {(p.quantity || 0) * (p.unitCost || 0)}</Typography>
            </Box>
          ))}
          <Button size="small" variant="outlined" onClick={() => setForm((f) => ({ ...f, items: { ...f.items, parts: [...f.items.parts, { name: '', quantity: 1, unitCost: 0 }] } }))}>+ Add Part</Button>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="Discount Type" select value={form.discount?.type} onChange={(e) => setForm((f) => ({ ...f, discount: { ...f.discount, type: e.target.value } }))} size="small">
              <MenuItem value="Fixed">Fixed</MenuItem><MenuItem value="Percentage">Percentage</MenuItem>
            </TextField>
            <TextField label="Discount Value" size="small" sx={{ width: 110 }} type="number" value={form.discount?.value || ''} onChange={(e) => setForm((f) => ({ ...f, discount: { ...f.discount, value: +e.target.value } }))} />
            <TextField label="Tax Rate (%)" size="small" sx={{ width: 110 }} type="number" value={form.tax?.rate || ''} onChange={(e) => setForm((f) => ({ ...f, tax: { ...f.tax, rate: +e.target.value } }))} />
          </Box>

          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="body2">Parts Total: {formatCurrency(totals.partsTotal)}</Typography>
            <Typography variant="body2">Discount: -{formatCurrency(totals.discountValue)}</Typography>
            <Typography variant="body2">Tax ({form.tax?.rate || 0}%): {formatCurrency(totals.tax)}</Typography>
            <Typography variant="h6" fontWeight={700}>Grand Total: {formatCurrency(totals.total)}</Typography>
          </Box>

          <TextField fullWidth label="Notes" value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} margin="normal" multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="outlined" onClick={() => handleSave('Draft')}>Save as Draft</Button>
          <Button variant="contained" onClick={() => handleSave('Pending Approval')}>Submit Estimate</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}