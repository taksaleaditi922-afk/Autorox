// ---------------------------------------------------------------------------
// Local draft fallback.
//
// Drafts are always written to localStorage (debounced by the caller) so a
// refresh, a crash or a lost connection never costs the advisor their work.
// When the backend accepts the draft the same blob is kept as an offline copy.
// ---------------------------------------------------------------------------

import type { EstimateState } from './types';
import { sanitizeStateForStorage } from './estimateService';

const STORAGE_PREFIX = 'autogarage.estimate.draft';
const ACTIVE_DRAFT_KEY = `${STORAGE_PREFIX}.active`;

export interface StoredDraft {
  id: string;
  savedAt: string;
  state: EstimateState;
}

function keyFor(id: string): string {
  return `${STORAGE_PREFIX}.${id}`;
}

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/** Persist a draft snapshot. Returns the draft key or null when unavailable. */
export function saveLocalDraft(state: EstimateState, id?: string): string | null {
  if (!canUseStorage()) return null;
  const draftId = id || state.draftId || 'local';
  try {
    const payload: StoredDraft = {
      id: draftId,
      savedAt: new Date().toISOString(),
      state: sanitizeStateForStorage(state),
    };
    window.localStorage.setItem(keyFor(draftId), JSON.stringify(payload));
    window.localStorage.setItem(ACTIVE_DRAFT_KEY, draftId);
    return draftId;
  } catch {
    // Quota exceeded or storage disabled — the in-memory state still stands.
    return null;
  }
}

export function loadLocalDraft(id?: string): StoredDraft | null {
  if (!canUseStorage()) return null;
  const draftId = id || window.localStorage.getItem(ACTIVE_DRAFT_KEY);
  if (!draftId) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(draftId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed?.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalDraft(id?: string): void {
  if (!canUseStorage()) return;
  const draftId = id || window.localStorage.getItem(ACTIVE_DRAFT_KEY);
  if (!draftId) return;
  try {
    window.localStorage.removeItem(keyFor(draftId));
    if (window.localStorage.getItem(ACTIVE_DRAFT_KEY) === draftId) {
      window.localStorage.removeItem(ACTIVE_DRAFT_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function hasLocalDraft(): boolean {
  return !!loadLocalDraft();
}

export default { saveLocalDraft, loadLocalDraft, clearLocalDraft, hasLocalDraft };
