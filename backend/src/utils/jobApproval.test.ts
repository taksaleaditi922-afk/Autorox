import { describe, expect, it } from 'vitest';
import { approvalExpired, serviceRevision, trackingSteps } from './jobApproval.js';

describe('job approval', () => {
  const job = { customer: { phone: '9876543210' }, services: [{ name: 'Wash', qty: 1, price: 249 }], orderSummary: { discount: 0 } };
  it('binds approvals to prices and the registered recipient', () => {
    expect(serviceRevision({ ...job, services: [{ ...job.services[0], price: 300 }] })).not.toBe(serviceRevision(job));
    expect(serviceRevision({ ...job, customer: { phone: '9876543211' } })).not.toBe(serviceRevision(job));
  });
  it('allows mechanic assignment without changing approved pricing', () => {
    expect(serviceRevision({ ...job, services: [{ ...job.services[0], assignedMechanic: { name: 'Ravi' } }] })).toBe(serviceRevision(job));
  });
  it('expires at the exact deadline and limits legacy links to seven days', () => {
    expect(approvalExpired({ expiresAt: '2026-09-24T00:00:00Z' }, new Date('2026-09-24T00:00:00Z'))).toBe(true);
    expect(approvalExpired({ sharedAt: '2026-09-23T00:00:00Z' }, new Date('2026-09-24T00:00:00Z'))).toBe(false);
    expect(approvalExpired({}, new Date())).toBe(true);
  });
  it('does not invent inspection or quality-check timestamps', () => {
    const steps = trackingSteps({ status: 'In Progress', approval: { status: 'approved', method: 'Link', respondedAt: '2026-09-24' } });
    expect(steps.find(step => step.label === 'Quality Check')?.state).toBe('pending');
    expect(steps.find(step => step.label === 'In Progress / Work Started')?.state).toBe('current');
    expect(steps.find(step => step.label === 'Approved by You')?.at).toBe('2026-09-24');
  });
});
