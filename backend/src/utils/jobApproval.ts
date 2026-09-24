import crypto from 'node:crypto';

export function serviceRevision(job: any): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    phone: job.customer?.phone || '',
    discount: Number(job.orderSummary?.discount || 0),
    items: (job.services || []).map((line: any) => [line.name, line.description || '', line.hsnSacCode || '', line.unit || 'nos', Number(line.qty), Number(line.price), line.taxType || 'None', Number(line.taxRate || 0), line.discountType || 'none', Number(line.discountValue || 0)]),
  })).digest('hex');
}

export function approvalExpired(approval: any, now = new Date()): boolean {
  const expiry = approval.expiresAt || (approval.sharedAt && new Date(new Date(approval.sharedAt).getTime() + 7 * 86400000));
  return !expiry || new Date(expiry).getTime() <= now.getTime();
}

export function trackingSteps(job: any) {
  const history = job.statusHistory || [];
  const time = (status: string) => history.find((entry: any) => entry.status === status)?.changedAt;
  const current = job.status === 'Delivered' ? 'Delivered' : job.status === 'Ready for Delivery' ? 'Ready for Delivery' : ['In Progress', 'Pending Parts'].includes(job.status) ? 'In Progress / Work Started' : job.approval?.sharedAt ? 'Service List Sent for Approval' : 'Job Received';
  const entries = [
    { label: 'Job Received', at: job.createdAt },
    { label: 'Inspection / Diagnosis', at: time('Inspection/Diagnosis') },
    { label: 'Service List Sent for Approval', at: job.approval?.sharedAt },
    ...(job.approval?.status === 'approved' ? [{ label: job.approval.method === 'Link' ? 'Approved by You' : 'Approved by Workshop', at: job.approval.approvedAt || job.approval.respondedAt }] : []),
    { label: 'In Progress / Work Started', at: time('In Progress') },
    { label: 'Quality Check', at: time('Quality Check') },
    { label: 'Ready for Delivery', at: time('Ready for Delivery') },
    { label: 'Delivered', at: time('Delivered') },
  ];
  return entries.map(entry => ({ ...entry, state: entry.label === current ? 'current' : entry.at ? 'done' : 'pending' }));
}
