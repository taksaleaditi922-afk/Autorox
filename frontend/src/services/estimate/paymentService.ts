// ---------------------------------------------------------------------------
// Advance / deposit payments.
//
// Amounts are validated against the business configuration before they are
// accepted, and the server re-validates them again when they are persisted.
// ---------------------------------------------------------------------------

import api from '../api';
import { maxAllowedAdvance, roundMoney } from '../../utils/estimateMath';
import { newId } from '../../utils/id';
import type { AdvancePayment, EstimateBusinessConfig, EstimateTotals, PaymentMode } from './types';

export interface AdvanceDraft {
  amount: number | string;
  mode: PaymentMode;
  date: string;
  reference?: string;
  notes?: string;
}

export interface AdvanceValidation {
  ok: boolean;
  error?: string;
}

/** Rules: positive amount, not in the future, never above the allowed cap. */
export function validateAdvance(
  advance: AdvanceDraft,
  totals: EstimateTotals,
  config: EstimateBusinessConfig,
  existing: AdvancePayment[] = []
): AdvanceValidation {
  const amount = Number(advance?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero' };
  }
  if (roundMoney(amount) !== amount && Math.abs(roundMoney(amount) - amount) > 0.0001) {
    return { ok: false, error: 'Amount can have at most 2 decimal places' };
  }
  if (!advance.date) {
    return { ok: false, error: 'Payment date is required' };
  }
  const when = new Date(advance.date).getTime();
  if (Number.isNaN(when)) return { ok: false, error: 'Payment date is invalid' };
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (when > today.getTime()) {
    return { ok: false, error: 'Payment date cannot be in the future' };
  }

  const cap = maxAllowedAdvance(totals.grandTotal, config);
  const alreadyPaid = existing.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  if (alreadyPaid + amount > cap + 0.001) {
    const allowed = Math.max(0, cap - alreadyPaid);
    if (cap === Number.POSITIVE_INFINITY) return { ok: true };
    return {
      ok: false,
      error: `Advance cannot exceed the estimate total. Maximum additional amount is ₹${allowed.toFixed(2)}`,
    };
  }
  return { ok: true };
}

function mapPayment(doc: any): AdvancePayment {
  return {
    id: doc._id || doc.id || newId('pay'),
    amount: Number(doc.amount) || 0,
    mode: (doc.mode as PaymentMode) || 'Cash',
    date: doc.date ? new Date(doc.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    reference: doc.reference || '',
    notes: doc.notes || '',
    recordedBy: doc.recordedBy || '',
    createdAt: doc.createdAt || new Date().toISOString(),
  };
}

export async function listAdvances(estimateId: string): Promise<AdvancePayment[]> {
  const res = await api.get(`/estimates/${estimateId}/payments`);
  return (res.data?.data || []).map(mapPayment);
}

export async function addAdvance(estimateId: string, advance: AdvanceDraft): Promise<AdvancePayment> {
  const res = await api.post(`/estimates/${estimateId}/payments`, {
    amount: roundMoney(Number(advance.amount)),
    mode: advance.mode,
    date: advance.date,
    reference: advance.reference,
    notes: advance.notes,
  });
  return mapPayment(res.data?.data);
}

export async function removeAdvance(estimateId: string, paymentId: string): Promise<void> {
  await api.delete(`/estimates/${estimateId}/payments/${paymentId}`);
}

/** Client-only payment row, used while the draft has not been persisted yet. */
export function localAdvance(advance: AdvanceDraft): AdvancePayment {
  return {
    id: newId('pay'),
    amount: roundMoney(Number(advance.amount)),
    mode: advance.mode,
    date: advance.date,
    reference: advance.reference || '',
    notes: advance.notes || '',
    recordedBy: 'You (this device)',
    createdAt: new Date().toISOString(),
  };
}

export default { listAdvances, addAdvance, removeAdvance, validateAdvance, localAdvance };
