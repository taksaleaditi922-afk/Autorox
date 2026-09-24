import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ findOne: vi.fn(), findOneAndUpdate: vi.fn() }));
vi.mock('../models/JobCard.js', () => ({ default: db, JOB_STATUS: { PENDING_APPROVAL: 'Pending Approval', IN_PROGRESS: 'In Progress' } }));
vi.mock('../utils/asyncHandler.js', () => ({ default: (fn: any) => fn }));
import { respondPublicApproval, getPublicApproval } from './publicApprovalController.js';

let job: any;
const response = () => ({ set: vi.fn(), json: vi.fn() });
const request = (decision = 'approve', comments = '') => ({ params: { token: 'a'.repeat(48) }, body: { decision, comments } });
beforeEach(() => {
  vi.clearAllMocks();
  job = { _id: 'job', __v: 2, status: 'Pending Approval', customer: { name: 'Customer' }, vehicle: {}, services: [], approval: { status: 'awaiting', expiresAt: new Date(Date.now() + 60000), history: [] }, orderSummary: {}, statusHistory: [] };
  db.findOne.mockResolvedValue(job);
  db.findOneAndUpdate.mockResolvedValue(job);
});
it('requires a reason for rejection', async () => {
  await expect(respondPublicApproval(request('changes'), response())).rejects.toMatchObject({ statusCode: 400 });
  expect(db.findOneAndUpdate).not.toHaveBeenCalled();
});
it('rejects expired and previously actioned decisions', async () => {
  job.approval.expiresAt = new Date(0);
  await expect(respondPublicApproval(request(), response())).rejects.toMatchObject({ statusCode: 410 });
  job.approval.status = 'approved';
  await expect(respondPublicApproval(request(), response())).rejects.toMatchObject({ statusCode: 409 });
});
it('atomically checks the token, pending state and document version', async () => {
  await respondPublicApproval(request(), response());
  expect(db.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ __v: 2, 'approval.status': 'awaiting', 'approval.token': 'a'.repeat(48) }), expect.objectContaining({ $inc: { __v: 1 }, $set: expect.objectContaining({ 'approval.method': 'Link', 'approval.status': 'approved', status: 'In Progress' }) }), expect.anything());
  db.findOneAndUpdate.mockResolvedValue(null);
  await expect(respondPublicApproval(request(), response())).rejects.toMatchObject({ statusCode: 409 });
});
it('records only the first view and leaves decided links readable after expiry', async () => {
  job.approval.status = 'approved'; job.approval.expiresAt = new Date(0); job.approval.viewedAt = new Date();
  const res = response();
  await getPublicApproval(request(), res);
  expect(db.findOneAndUpdate).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
});
