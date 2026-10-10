import { approvalExpired, serviceRevision, trackingSteps } from '../utils/jobApproval.js';
import env from '../config/env.js';
// ---------------------------------------------------------------------------
// Public service-list approval.
//
// The customer opens /approval/:token on their phone and either approves the
// itemised list or asks for changes. These handlers are intentionally outside
// the auth middleware: the token *is* the credential. They expose a deliberately
// narrow view of the job card — never the customer's phone, email, address, ID
// proof or internal notes.
// ---------------------------------------------------------------------------

import JobCard, { JOB_STATUS } from '../models/JobCard.js';
import ApiError from '../utils/ApiError.js';

/** Tokens are 36 hex characters; anything else is a probing attempt. */
const TOKEN_REGEX = /^[a-f0-9]{16,64}$/i;

/** The safe projection a customer is allowed to see. */
function publicView(jobCard: any) {
  const money = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    business: env.business,
    createdAt: jobCard.createdAt,
    tracking: trackingSteps(jobCard),
    jobCardNumber: jobCard.jobCardNumber,
    status: jobCard.status,
    customerName: jobCard.customer?.name || '',
    vehicle: {
      registrationNumber: jobCard.vehicle?.registrationNumber || '',
      make: jobCard.vehicle?.make || '',
      model: jobCard.vehicle?.model || '',
      year: jobCard.vehicle?.year || null,
    },
    items: (jobCard.services || []).map((line: any) => ({
      name: line.name,
      description: line.description || '',
      type: line.type,
      hsnSacCode: line.hsnSacCode || '',
      unit: line.unit || 'nos',
      qty: money(line.qty),
      price: money(line.price),
      taxType: line.taxType || 'None',
      taxRate: money(line.taxRate),
      discountType: line.discountType || 'none',
      discountValue: money(line.discountValue),
      discountAmount: money(line.discountAmount),
      subtotal: money(line.subtotal),
      taxAmount: money(line.taxAmount),
      total: money(line.total),
    })),
    totals: {
      subtotal: money(jobCard.orderSummary?.subtotal),
      discount: money(jobCard.orderSummary?.discount),
      lineDiscount: money(jobCard.orderSummary?.lineDiscount),
      tax: money(jobCard.orderSummary?.tax),
      total: money(jobCard.orderSummary?.total ?? jobCard.grandTotal),
      grandTotal: money(jobCard.grandTotal ?? jobCard.orderSummary?.total),
      advanceDeducted: money(jobCard.orderSummary?.advanceDeducted),
      balanceDue: money(jobCard.orderSummary?.balanceDue),
    },
    advance: jobCard.advance?.amount
      ? {
          amount: money(jobCard.advance.amount),
          paymentMode: jobCard.advance.paymentMode,
          recordedAt: jobCard.advance.recordedAt,
        }
      : null,
    approval: {
      expiresAt: jobCard.approval?.expiresAt || (jobCard.approval?.sharedAt ? new Date(new Date(jobCard.approval.sharedAt).getTime() + 7 * 86400000) : null),
      viewedAt: jobCard.approval?.viewedAt || null,
      status: jobCard.approval?.status || 'not_sent',
      sharedAt: jobCard.approval?.sharedAt || null,
      respondedAt: jobCard.approval?.respondedAt || null,
      response: jobCard.approval?.response || '',
      method: jobCard.approval?.method || '',
    },
  };
}

async function findByToken(token: string) {
  if (!token || !TOKEN_REGEX.test(token)) {
    throw new ApiError(404, 'This approval link is not valid.');
  }
  const jobCard = await JobCard.findOne({ 'approval.token': token });
  if (!jobCard) throw new ApiError(404, 'This approval link is not valid or has been replaced.');
  return jobCard;
}

// GET /api/public/approvals/:token
export const getPublicApproval = async (routeParams: any): Promise<any> => {
  let jobCard = await findByToken(routeParams.token);
  if (!jobCard.approval.viewedAt) {
    const viewed = await JobCard.findOneAndUpdate({ _id: jobCard._id, 'approval.token': routeParams.token, 'approval.viewedAt': null }, {
      $set: { 'approval.viewedAt': new Date() },
      $inc: { __v: 1 },
      $push: { 'approval.history': { action: 'Customer viewed approval link', by: jobCard.customer?.name || 'Customer', at: new Date(), channel: 'Link' } },
    }, { new: true });
    if (viewed) jobCard = viewed;
  }

  return { success: true, data: publicView(jobCard) };
};

// POST /api/public/approvals/:token/respond   { decision: 'approve' | 'changes', comments }
export const respondPublicApproval = async (routeParams: any, payload: any): Promise<any> => {
  const jobCard = await findByToken(routeParams.token);
  const decision = String(payload?.decision || '').toLowerCase();
  if (!['approve', 'changes'].includes(decision)) {
    throw new ApiError(400, "decision must be either 'approve' or 'changes'");
  }

  const now = new Date();
  const comments = typeof payload?.comments === 'string' ? payload.comments.trim().slice(0, 500) : '';
  const approved = decision === 'approve';

  if (decision === 'changes' && !comments) throw new ApiError(400, 'A reason is required to reject the service list.');
  if (jobCard.approval.status !== 'awaiting') throw new ApiError(409, 'This service list has already been actioned or is no longer awaiting approval.');
  if (approvalExpired(jobCard.approval, now)) throw new ApiError(410, 'This approval link has expired. Contact the workshop for a new link.');
  if (jobCard.approval.revision && jobCard.approval.revision !== serviceRevision(jobCard)) throw new ApiError(409, 'The service list has changed. Request a new approval link.');
  const who = jobCard.customer?.name || 'Customer';
  const set: any = {
    'approval.status': approved ? 'approved' : 'changes_requested',
    'approval.respondedAt': now, 'approval.response': comments, 'approval.method': 'Link',
    'approval.approvedBy': approved ? who : '', 'approval.approvedAt': approved ? now : null,
  };
  const push: any = {
    'approval.history': { action: approved ? 'Customer approved' : 'Customer rejected', by: who, at: now, note: comments, channel: 'Link' },
    audit: { action: approved ? 'Customer approved the service list' : 'Customer rejected the service list', by: who, at: now, details: comments },
  };
  if (approved && jobCard.status === JOB_STATUS.PENDING_APPROVAL) {
    set.status = JOB_STATUS.IN_PROGRESS;
    push.statusHistory = { status: JOB_STATUS.IN_PROGRESS, changedBy: who, changedAt: now, notes: 'Customer approved through the public link' };
  }
  // Compare-and-set prevents two devices deciding twice, or deciding a revised list.
  const updated = await JobCard.findOneAndUpdate({ _id: jobCard._id, __v: jobCard.__v, 'approval.token': routeParams.token, 'approval.status': 'awaiting' }, {
    $set: set, $push: push, $inc: { __v: 1 },
  }, { new: true, runValidators: true });
  if (!updated) throw new ApiError(409, 'The job changed while you were responding. Refresh to see its latest status.');

  return { success: true, data: publicView(updated), message: 'Your response has been recorded.' };
};

export default { getPublicApproval, respondPublicApproval };
