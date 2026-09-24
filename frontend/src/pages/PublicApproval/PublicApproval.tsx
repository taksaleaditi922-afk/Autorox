import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Link, Stack, TextField, Typography } from '@mui/material';
import { fetchPublicApproval, respondPublicApproval, type PublicApproval as Approval } from '../../services/jobCard/approvalService';
import { PricingSummary } from '../../components/jobCard/ApprovalReview';
import JobTracking from '../../components/jobCard/JobTracking';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function PublicApproval() {
  const { token = '' } = useParams();
  const [data, setData] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState('');
  const [decision, setDecision] = useState<'approve' | 'changes' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    setData(null); setLoading(true); setError(''); setDecision(null); setComments('');
    const load = async () => {
      if (pending || submittingRef.current || document.hidden) return;
      pending = true;
      const version = generation.current;
      try {
        const next = await fetchPublicApproval(token);
        if (active && version === generation.current) { setData(next); setError(''); }
      } catch (err: any) {
        if (active) {
          if ([404, 410].includes(err?.response?.status)) setData(null);
          setError(err?.response?.data?.error || 'Unable to refresh this job. Please check your connection.');
        }
      } finally { pending = false; if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); };
  }, [token]);
  const shop = data?.business || { name: import.meta.env.VITE_BUSINESS_NAME || 'Your workshop', phone: import.meta.env.VITE_BUSINESS_PHONE, logoUrl: import.meta.env.VITE_BUSINESS_LOGO };
  useEffect(() => {
    const old = document.title;
    document.title = shop.name + ' - Approve your service request';
    return () => { document.title = old; };
  }, [shop.name]);
  const status = data?.approval.status;
  const decided = status === 'approved' || status === 'changes_requested';
  const expired = Boolean(data?.approval.expiresAt && new Date(data.approval.expiresAt).getTime() <= Date.now());
  useEffect(() => { if (decided || expired) setDecision(null); }, [decided, expired]);
  const respond = async () => {
    if (!decision || submittingRef.current || decided || expired || (decision === 'changes' && !comments.trim())) return;
    submittingRef.current = true; generation.current += 1; setSubmitting(true); setError('');
    try {
      setData(await respondPublicApproval(token, { decision, comments: comments.trim() }));
      setDecision(null);
    } catch (err: any) { setError(err?.response?.data?.error || 'Could not submit your response. Please retry.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><CircularProgress aria-label="Loading job" /></Box>;
  if (!data) return <Container maxWidth="sm" sx={{ py: 6 }}><Alert severity="error">{error || 'This approval link is unavailable.'}</Alert><Button onClick={() => window.location.reload()}>Retry</Button></Container>;
  return <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, sm: 4 } }}><Container maxWidth="sm"><Stack spacing={2}>
    <Card component="header"><CardContent><Stack direction="row" gap={1.5} alignItems="center"><Avatar src={shop.logoUrl} alt={shop.name}>{shop.name[0]}</Avatar><Typography variant="h5" component="h1" fontWeight={800}>{shop.name}</Typography></Stack><Typography mt={2}>Job Card {data.jobCardNumber}</Typography><Typography fontWeight={700}>{data.customerName}</Typography><Typography variant="body2" color="text.secondary">{[data.vehicle.registrationNumber, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' / ')}</Typography><Chip sx={{ mt: 2 }} label={decided ? status === 'approved' ? (data.approval.method === 'Link' ? 'Approved by You' : 'Approved by Workshop') : (data.approval.method === 'Link' ? 'Rejected by You' : 'Rejected by Workshop') : expired ? 'Approval link expired' : 'Awaiting Your Approval'} /></CardContent></Card>
    {error && <Alert severity="error">{error}</Alert>}
    <Card><CardContent><JobTracking data={data} /></CardContent></Card>
    <Card><CardContent><Typography variant="h6" component="h2" fontWeight={700} mb={2}>Your service list</Typography><Stack spacing={2}>{data.items.map((item, index) => <Box key={index} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}><Typography fontWeight={700}>{item.name}</Typography>{item.description && <Box component="details"><Typography component="summary">Service details</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{item.description}</Typography></Box>}<Stack direction="row" justifyContent="space-between" gap={2} mt={1}><Typography variant="body2">{item.qty} {item.unit} x {formatCurrency(item.price)}</Typography><Typography fontWeight={700}>{formatCurrency(item.total)}</Typography></Stack><Typography variant="caption" color="text.secondary">Tax {formatCurrency(item.taxAmount)} / Discount {formatCurrency(item.discountAmount)}</Typography></Box>)}</Stack>{!data.items.length && <Typography>No services listed.</Typography>}<Box mt={2}><PricingSummary totals={data.totals} payments /></Box></CardContent></Card>
    <Card><CardContent>{decided ? <Alert severity={status === 'approved' ? 'success' : 'warning'}>{status === 'approved' ? 'Already Approved' : 'Already Rejected'}{data.approval.respondedAt ? ' on ' + formatDateTime(data.approval.respondedAt) : ''}. Revisit this link to track your job.{data.approval.response && <Typography variant="body2">Your note: {data.approval.response}</Typography>}</Alert> : expired ? <Alert severity="warning">This approval request has expired. Contact the workshop for a new link.</Alert> : <><Typography variant="h6" component="h2">Your decision</Typography><Typography variant="body2" color="text.secondary" mb={2}>Review the services and total above before authorising the work.</Typography><Stack spacing={2}><Button size="large" variant="contained" disabled={!data.items.length || Boolean(error)} onClick={() => setDecision('approve')} sx={{ bgcolor: '#00B42A', '&:hover': { bgcolor: '#009a24' }, minHeight: 48 }}>Approve</Button><Button size="large" variant="outlined" color="warning" disabled={!data.items.length || Boolean(error)} onClick={() => setDecision('changes')} sx={{ minHeight: 48 }}>Reject</Button></Stack></>}</CardContent></Card>
    <Box component="footer" py={2}><Typography fontWeight={700}>Need help? Contact us</Typography>{shop.phone ? <Link href={'tel:' + shop.phone.replace(/[^+\d]/g, '')}>{shop.phone}</Link> : <Typography variant="body2">Contact the workshop using the conversation where you received this link.</Typography>}{data.business?.whatsapp && <Button component="a" href={'https://wa.me/' + data.business.whatsapp.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer">Chat with the shop</Button>}<Typography variant="caption" display="block" mt={1}>Job status refreshes automatically every 15 seconds.</Typography></Box>
  </Stack></Container><Dialog open={Boolean(decision)} onClose={() => { if (!submitting) setDecision(null); }} aria-labelledby="decision-title" fullWidth maxWidth="xs"><DialogTitle id="decision-title">{decision === 'approve' ? 'Approve this service list?' : 'Reject this service list?'}</DialogTitle><DialogContent><Typography mb={2}>{decision === 'approve' ? 'Are you sure you want to approve these services for ' + formatCurrency(data.totals.grandTotal) + '?' : 'Please tell the workshop why you are rejecting this list.'}</Typography>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<TextField autoFocus fullWidth multiline minRows={3} required={decision === 'changes'} label={decision === 'changes' ? 'Reason for rejection' : 'Remarks (optional)'} value={comments} disabled={submitting} onChange={e => setComments(e.target.value)} inputProps={{ maxLength: 500 }} /></DialogContent><DialogActions><Button disabled={submitting} onClick={() => setDecision(null)}>Cancel</Button><Button variant="contained" disabled={submitting || (decision === 'changes' && !comments.trim())} onClick={respond}>{submitting ? 'Submitting...' : 'Confirm ' + (decision === 'approve' ? 'approval' : 'rejection')}</Button></DialogActions></Dialog></Box>;
}
