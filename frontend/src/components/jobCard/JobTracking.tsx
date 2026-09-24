import { useEffect, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { PublicApproval } from '../../services/jobCard/approvalService';
import { formatDateTime } from '../../utils/format';

export default function JobTracking({ data }: { data: PublicApproval }) {
  const current = useRef<HTMLLIElement>(null);
  const scrolled = useRef(false);
  const labels = ['Job Received', 'Inspection / Diagnosis', 'Service List Sent for Approval', ...(data.approval.status === 'approved' ? ['Approved by You'] : []), 'In Progress / Work Started', 'Quality Check', 'Ready for Delivery', 'Delivered'];
  const activeLabel = data.status === 'Delivered' ? 'Delivered' : data.status === 'Ready for Delivery' ? 'Ready for Delivery' : data.status === 'In Progress' || data.status === 'Pending Parts' ? 'In Progress / Work Started' : data.approval.sharedAt ? 'Service List Sent for Approval' : 'Job Received';
  // Do not infer completed inspections or quality checks from a later job status.
  const steps = data.tracking?.length ? data.tracking : labels.map(label => {
    const at = label === 'Job Received' ? data.createdAt : label === 'Service List Sent for Approval' ? data.approval.sharedAt : label === 'Approved by You' ? data.approval.respondedAt : undefined;
    return { label, at, state: (label === activeLabel ? 'current' : at ? 'done' : 'pending') as 'done' | 'current' | 'pending' };
  });
  useEffect(() => {
    if (!scrolled.current && current.current) {
      current.current.scrollIntoView?.({ behavior: 'auto', block: 'nearest' });
      scrolled.current = true;
    }
  }, [steps]);
  return <Box component="section" aria-labelledby="job-tracking"><Typography id="job-tracking" variant="h6" fontWeight={700}>Track your job</Typography><Typography variant="body2" color="text.secondary" mb={2}>Current workshop status: {data.status}</Typography><Stack component="ol" spacing={1} sx={{ p: 0, listStyle: 'none' }}>{steps.map((step, index) => <Box component="li" key={`${step.label}-${index}`} ref={step.state === 'current' ? current : undefined} aria-current={step.state === 'current' ? 'step' : undefined} sx={{ border: step.state === 'current' ? 2 : 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}><Stack direction="row" gap={1.5}><Typography aria-hidden="true" fontWeight={800}>{step.state === 'done' ? '✓' : step.state === 'current' ? '➜' : '○'}</Typography><Box><Typography fontWeight={step.state === 'current' ? 800 : 500}>{step.label}</Typography><Typography variant="caption">{step.state === 'done' ? 'Completed' : step.state === 'current' ? 'Current stage' : 'Awaiting update'}{step.at ? ` · ${formatDateTime(step.at)}` : ''}</Typography></Box></Stack></Box>)}</Stack>{data.approval.status === 'changes_requested' && <Typography role="status">You rejected the service list. Please contact the workshop about revisions.</Typography>}</Box>;
}
