import api from '../api';
import axios from 'axios';

// Public token links must not trigger admin session refresh or login handling.
const publicApi = axios.create({ baseURL: api.defaults.baseURL });

// ---------------------------------------------------------------------------
// Job card service list: advance payments and the customer approval flow.
// ---------------------------------------------------------------------------

export interface DeliveryResult {
  channel: string;
  to: string;
  delivered: boolean;
  reason?: string;
}

export interface ShareApprovalResult {
  token: string;
  link: string;
  status: string;
  sharedAt: string;
  delivery: DeliveryResult[];
}

export interface AdvancePayload {
  amount: number;
  paymentMode: string;
  reference?: string;
}

export interface PublicApprovalItem {
  description?: string;
  name: string;
  type: string;
  hsnSacCode: string;
  unit: string;
  qty: number;
  price: number;
  taxType: string;
  taxRate: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface PublicApproval {
  business?: { name: string; logoUrl?: string; phone?: string; whatsapp?: string };
  tracking?: { label: string; state: 'done' | 'current' | 'pending'; at?: string }[];
  createdAt?: string;
  jobCardNumber: string;
  status: string;
  customerName: string;
  vehicle: { registrationNumber: string; make: string; model: string; year: number | null };
  items: PublicApprovalItem[];
  totals: {
    subtotal: number;
    discount: number;
    lineDiscount: number;
    tax: number;
    total: number;
    grandTotal: number;
    advanceDeducted: number;
    balanceDue: number;
  };
  advance: { amount: number; paymentMode: string; recordedAt: string | null } | null;
  approval: {
    expiresAt?: string;
    viewedAt?: string;
    status: string;
    sharedAt: string | null;
    respondedAt: string | null;
    response: string;
    method: string;
  };
}

/** PATCH /jobcards/:id/advance — record (or clear, with amount 0) a deposit. */
export async function recordAdvance(id: string, payload: AdvancePayload): Promise<any> {
  const res = await api.patch(`/jobcards/${id}/advance`, payload);
  return res.data.data;
}

/** POST /jobcards/:id/approval/share — send the itemised list and get the link. */
export async function shareApproval(
  id: string,
  payload: { channels: string[]; message?: string }
): Promise<ShareApprovalResult> {
  const res = await api.post(`/jobcards/${id}/approval/share`, payload);
  return res.data.data;
}

/** PATCH /jobcards/:id/approval — record approved / changes requested / skipped. */
export async function updateApproval(id: string, payload: Record<string, unknown>): Promise<any> {
  const res = await api.patch(`/jobcards/${id}/approval`, payload);
  return res.data.data;
}

// --- public (no login) -----------------------------------------------------

export async function fetchPublicApproval(token: string): Promise<PublicApproval> {
  const res = await publicApi.get(`/public/approvals/${encodeURIComponent(token)}`);
  return res.data.data;
}

export async function respondPublicApproval(
  token: string,
  payload: { decision: 'approve' | 'changes'; comments?: string }
): Promise<PublicApproval> {
  const res = await publicApi.post(`/public/approvals/${encodeURIComponent(token)}/respond`, payload);
  return res.data.data;
}

export default {
  recordAdvance,
  shareApproval,
  updateApproval,
  fetchPublicApproval,
  respondPublicApproval,
};
