// ---------------------------------------------------------------------------
// Estimate service.
//
// Every draft / generate call goes through here. The server recomputes all
// financial values, so the payload deliberately sends the raw inputs plus the
// client totals for comparison — never as the source of truth.
// ---------------------------------------------------------------------------

import api from '../api';
import { DEFAULT_BUSINESS_CONFIG } from './config';
import type { EstimateState } from './types';

export interface EstimateListParams {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface EstimateListResult {
  data: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Fields that only exist in the browser and must never be sent to the API. */
const UI_ONLY_KEYS = ['saveState', 'dirty', 'errors', 'loadingDraft', 'generating'] as const;

/** Strip blob/file handles before persisting a draft anywhere. */
export function sanitizeStateForStorage(state: EstimateState): EstimateState {
  const stripMedia = (media: any[] = []) =>
    media.map((m) => {
      const { file, url, ...rest } = m;
      const localOnly = !m.storageKey && !m.serverId;
      return { ...rest, localOnly, url: localOnly ? undefined : url };
    });

  return {
    ...state,
    inspection: (state.inspection || []).map((category) => ({
      ...category,
      items: (category.items || []).map((item) => ({ ...item, media: stripMedia(item.media) })),
    })),
    insurance: {
      ...state.insurance,
      document: state.insurance?.document
        ? (() => {
            const { url, ...rest } = state.insurance.document as any;
            return { ...rest, url: rest.storageKey ? url : undefined };
          })()
        : null,
    },
    identityProof: {
      ...state.identityProof,
      document: state.identityProof?.document
        ? (() => {
            const { url, ...rest } = state.identityProof.document as any;
            return { ...rest, url: rest.storageKey ? url : undefined };
          })()
        : null,
    },
  } as EstimateState;
}

/** Build the API payload from the wizard state. */
export function toApiPayload(state: EstimateState, options: { includeClientTotals?: boolean } = {}) {
  const payload: Record<string, any> = {
    vehicle: state.vehicle,
    customer: state.customer,
    insurance: state.insurance,
    documents: state.documents,
    identityProof: state.identityProof,
    pickup: state.pickup,
    bookingSource: state.bookingSource,
    complaint: state.complaint,
    inspection: state.inspection,
    lineItems: state.lineItems,
    payments: state.payments,
    metadata: state.metadata,
    notes: state.notes,
    terms: state.terms,
    status: state.status,
  };
  for (const key of UI_ONLY_KEYS) delete payload[key];
  if (options.includeClientTotals) {
    payload.clientTotals = state.totals;
  }
  return payload;
}

/** Hydrate wizard state from an API document. */
export function fromApiDocument(doc: any): Partial<EstimateState> {
  if (!doc) return {};
  return {
    draftId: doc._id || doc.id || null,
    status: doc.status || 'Draft',
    vehicle: doc.vehicle || undefined,
    customer: doc.customer || undefined,
    insurance: doc.insurance || undefined,
    documents: doc.documents || undefined,
    identityProof: doc.identityProof || undefined,
    pickup: doc.pickup || undefined,
    bookingSource: doc.bookingSource || '',
    complaint: doc.complaint || '',
    inspection: doc.inspection || [],
    lineItems: doc.lineItems || [],
    payments: doc.payments || [],
    notes: doc.notes || '',
    terms: doc.terms || doc.metadata?.terms || '',
    metadata: doc.metadata || undefined,
  };
}

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

export async function createDraft(state: EstimateState): Promise<string> {
  const res = await api.post('/estimates/drafts', toApiPayload(state));
  const doc = res.data?.data;
  const id = doc?._id || doc?.id;
  if (!id) throw new Error('The server did not return a draft id');
  return id;
}

export async function updateDraft(id: string, state: EstimateState): Promise<any> {
  const res = await api.put(`/estimates/${id}/draft`, toApiPayload(state));
  return res.data?.data;
}

/** Create-or-update. Returns the draft id (creating one when needed). */
export async function saveDraft(state: EstimateState): Promise<string> {
  if (!state.draftId) {
    return createDraft(state);
  }
  await updateDraft(state.draftId, state);
  return state.draftId;
}

export async function getDraft(id: string): Promise<Partial<EstimateState>> {
  const res = await api.get(`/estimates/${id}`);
  return fromApiDocument(res.data?.data);
}

export async function listEstimates(params: EstimateListParams = {}): Promise<EstimateListResult> {
  const res = await api.get('/estimates', { params });
  const body = res.data || {};
  const data = body.data || [];
  return {
    data,
    pagination: body.pagination || {
      page: params.page || 1,
      limit: params.limit || data.length || 10,
      total: data.length,
      totalPages: 1,
    },
  };
}

export async function deleteDraft(id: string): Promise<void> {
  await api.delete(`/estimates/${id}`);
}

/**
 * Generate the final estimate. The server validates, recalculates and issues
 * the estimate number. Client totals are sent only for drift comparison, and
 * the response includes the server totals so the UI can show any correction.
 */
export async function generate(id: string, state: EstimateState): Promise<any> {
  const res = await api.post(`/estimates/${id}/generate`, {
    ...toApiPayload(state),
    includeClientTotals: true,
    clientTotals: state.totals,
  });
  return res.data?.data;
}

/** Preview the next estimate number without consuming it. */
export async function peekNextNumber(): Promise<string> {
  try {
    const res = await api.get('/estimates/next-number');
    return res.data?.data?.estimateNumber || '';
  } catch {
    const year = new Date().getFullYear();
    const seq = String(Date.now()).slice(-6);
    return `${DEFAULT_BUSINESS_CONFIG.estimatePrefix}-${year}-${seq}`;
  }
}

export default {
  createDraft,
  updateDraft,
  saveDraft,
  getDraft,
  listEstimates,
  deleteDraft,
  generate,
  peekNextNumber,
  toApiPayload,
  fromApiDocument,
  sanitizeStateForStorage,
};
