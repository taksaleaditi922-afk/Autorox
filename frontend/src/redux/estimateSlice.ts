// ---------------------------------------------------------------------------
// Centralised estimate state.
//
// Every one of the four steps reads and writes this slice, so data always
// survives "Back"/"Save & Continue". Any reducer that can change money calls
// recalculate() at the end, which is the only place the totals are produced.
// ---------------------------------------------------------------------------

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_BUSINESS_CONFIG,
  getDocumentStatus,
} from '../services/estimate/config';
import * as estimateService from '../services/estimate/estimateService';
import * as draftStorage from '../services/estimate/draftStorage';
import { defaultCategories } from '../services/estimate/inspectionService';
import { localAdvance } from '../services/estimate/paymentService';
import type {
  AdvancePayment,
  Customer,
  EstimateBusinessConfig,
  EstimateLineItem,
  EstimateState,
  InspectionCategory,
  InspectionStatus,
  MediaAttachment,
  UploadedDocument,
} from '../services/estimate/types';
import {
  EMPTY_TOTALS,
  calculateLineItem,
  computeEstimateTotals,
} from '../utils/estimateMath';
import { newId } from '../utils/id';
import type { RootState } from '../store/store';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function createEmptyEstimate(config: EstimateBusinessConfig = DEFAULT_BUSINESS_CONFIG): EstimateState {
  return {
    draftId: null,
    currentStep: 0,
    maxStepReached: 0,
    completedSteps: [],
    status: 'Draft',

    vehicle: {
      type: '4W',
      registrationNumber: '',
      brand: '',
      model: '',
      variant: '',
      year: '',
      fuelType: '',
      engineNumber: '',
      chassisNumber: '',
      color: '',
      odometer: '',
      fuelMeter: '',
      evBatteryCapacity: '',
      evChargerType: '',
    },

    customer: { name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gstNumber: '' },

    insurance: { company: '', policyNumber: '', startDate: '', expiryDate: '', document: null },

    // Reminders start off: an enabled reminder without an expiry date is a
    // validation error, so a fresh draft must not carry one.
    documents: {
      rc: { expiryDate: '', setReminder: false },
      puc: { expiryDate: '', setReminder: false },
      license: { expiryDate: '', setReminder: false },
    },

    identityProof: { idType: '', idNumber: '', document: null },

    pickup: {
      enabled: false,
      address: '',
      contactPerson: '',
      phone: '',
      preferredDate: '',
      preferredTime: '',
      notes: '',
    },

    bookingSource: 'Walk-in',
    complaint: '',

    inspection: defaultCategories(),

    lineItems: [],
    payments: [],
    totals: { ...EMPTY_TOTALS },

    metadata: {
      estimateNumber: '',
      estimateDate: isoDate(new Date()),
      validUntil: addDays(config.validUntilDays),
      createdBy: '',
      lastSavedAt: undefined,
      generatedAt: undefined,
      revision: 1,
    },

    notes: '',
    terms: '',

    saveState: 'idle',
    lastSavedAt: null,
    dirty: false,
    errors: {},
    loadingDraft: false,
    generating: false,
    generated: false,
  };
}

export interface EstimateSliceState {
  config: EstimateBusinessConfig;
  estimate: EstimateState;
  /** Shown as a banner when an unsaved local draft was recovered. */
  draftNotice: string | null;
  /** 'local' when the last successful persistence was the browser fallback. */
  persistence: 'none' | 'server' | 'local';
  /** Increments on every user edit; drives the debounced autosave. */
  changeSeq: number;
}

export function createInitialSliceState(): EstimateSliceState {
  return {
    config: DEFAULT_BUSINESS_CONFIG,
    estimate: createEmptyEstimate(DEFAULT_BUSINESS_CONFIG),
    draftNotice: null,
    persistence: 'none',
    changeSeq: 0,
  };
}

const initialState: EstimateSliceState = createInitialSliceState();

/** The single place totals are computed. Always applied after a money change. */
function recalculate(state: EstimateSliceState, options: { dirty?: boolean } = {}): void {
  const { estimate, config } = state;
  estimate.lineItems = estimate.lineItems.map((item) =>
    calculateLineItem(item, { supplyType: config.supplyType })
  );
  estimate.totals = computeEstimateTotals(estimate.lineItems, estimate.payments, config, {
    supplyType: config.supplyType,
  });
  if (options.dirty !== false) {
    markDirty(state);
  }
}

/**
 * Mark the draft as changed and bump the change sequence.
 *
 * Autosave keys off `changeSeq` rather than `dirty`: saving a draft flips
 * `dirty`/`saveState`, and a debounced autosave watching those would re-fire on
 * its own write. The sequence only moves when the user actually edits.
 */
function markDirty(state: EstimateSliceState): void {
  state.estimate.dirty = true;
  state.estimate.saveState = 'idle';
  state.changeSeq += 1;
}

function findCategory(estimate: EstimateState, categoryId: string): InspectionCategory | undefined {
  return estimate.inspection.find((c) => c.id === categoryId);
}

/**
 * Merge a partial (from the server or local storage) onto fresh defaults so a
 * hydrated payload can never leave a nested section undefined.
 */
function mergePartial(base: EstimateState, partial: Partial<EstimateState>): EstimateState {
  return {
    ...base,
    ...partial,
    vehicle: { ...base.vehicle, ...(partial.vehicle || {}) },
    customer: { ...base.customer, ...(partial.customer || {}) },
    insurance: { ...base.insurance, ...(partial.insurance || {}) },
    documents: {
      rc: { ...base.documents.rc, ...(partial.documents?.rc || {}) },
      puc: { ...base.documents.puc, ...(partial.documents?.puc || {}) },
      license: { ...base.documents.license, ...(partial.documents?.license || {}) },
    },
    identityProof: { ...base.identityProof, ...(partial.identityProof || {}) },
    pickup: { ...base.pickup, ...(partial.pickup || {}) },
    inspection: partial.inspection?.length ? partial.inspection : base.inspection,
    lineItems: partial.lineItems || base.lineItems,
    payments: partial.payments || base.payments,
    metadata: { ...base.metadata, ...(partial.metadata || {}) },
    errors: {},
    saveState: 'idle',
    dirty: false,
    generating: false,
  };
}

function deriveDocumentStatus(estimate: EstimateState, config: EstimateBusinessConfig) {
  return {
    rc: getDocumentStatus(estimate.documents.rc?.expiryDate, config.reminderThresholdDays),
    puc: getDocumentStatus(estimate.documents.puc?.expiryDate, config.reminderThresholdDays),
    license: getDocumentStatus(estimate.documents.license?.expiryDate, config.reminderThresholdDays),
    insurance: getDocumentStatus(estimate.insurance?.expiryDate, config.reminderThresholdDays),
  };
}

// ---------------------------------------------------------------------------
// Async work
// ---------------------------------------------------------------------------

/**
 * Persist the current draft. The server is tried first; on any failure the
 * browser fallback is used and reported back so the UI can be honest about it.
 */
export const saveDraft = createAsyncThunk(
  'estimate/saveDraft',
  async (_arg: { silent?: boolean } | undefined, { getState }) => {
    const state = getState() as RootState;
    const { estimate: current, config } = state.estimate;

    // 1. Always keep a local copy first — cheap insurance against a lost tab.
    draftStorage.saveLocalDraft(current, current.draftId || 'local');

    // 2. Try the server.
    try {
      const id = await estimateService.saveDraft(current);
      draftStorage.saveLocalDraft({ ...current, draftId: id }, id);
      return { ok: true as const, id, savedAt: new Date().toISOString(), persistence: 'server' as const };
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Could not reach the server. Your draft is saved in this browser.';
      return {
        ok: false as const,
        id: current.draftId,
        savedAt: new Date().toISOString(),
        persistence: 'local' as const,
        message,
        config,
      };
    }
  }
);

/** Load an existing estimate into the wizard (draft or generated). */
export const loadEstimate = createAsyncThunk('estimate/loadEstimate', async (id: string) => {
  const partial = await estimateService.getDraft(id);
  return partial;
});

/** Pull the server business configuration (falls back to local defaults). */
export const loadBusinessConfig = createAsyncThunk('estimate/loadBusinessConfig', async () => {
  const { getBusinessConfig } = await import('../services/estimate/catalogService');
  return getBusinessConfig();
});

/** Validate, recalculate and generate the estimate on the server. */
export const generateEstimate = createAsyncThunk(
  'estimate/generateEstimate',
  async (_arg: undefined, { getState }) => {
    const state = getState() as RootState;
    const { estimate: current } = state.estimate;
    if (!current.draftId) {
      // Persist first so the server has something to validate.
      const id = await estimateService.saveDraft(current);
      const doc = await estimateService.generate(id, { ...current, draftId: id });
      return { id, doc };
    }
    const doc = await estimateService.generate(current.draftId, current);
    return { id: current.draftId, doc };
  }
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const estimateSlice = createSlice({
  name: 'estimate',
  initialState,
  reducers: {
    /* ---------------------------- navigation ---------------------------- */
    setCurrentStep(state, action: PayloadAction<number>) {
      const step = Math.max(0, Math.min(action.payload, 3));
      if (step > state.estimate.maxStepReached) return;
      state.estimate.currentStep = step;
    },
    /** Advance only when the caller has validated the current step. */
    advanceStep(state) {
      const next = Math.min(state.estimate.currentStep + 1, 3);
      const current = state.estimate.currentStep;
      if (!state.estimate.completedSteps.includes(current)) {
        state.estimate.completedSteps.push(current);
      }
      state.estimate.currentStep = next;
      state.estimate.maxStepReached = Math.max(state.estimate.maxStepReached, next);
    },
    goBackStep(state) {
      state.estimate.currentStep = Math.max(state.estimate.currentStep - 1, 0);
    },
    markStepComplete(state, action: PayloadAction<number>) {
      if (!state.estimate.completedSteps.includes(action.payload)) {
        state.estimate.completedSteps.push(action.payload);
      }
      state.estimate.maxStepReached = Math.max(state.estimate.maxStepReached, action.payload);
    },
    /** Jump to any step the user has already unlocked. */
    jumpToStep(state, action: PayloadAction<number>) {
      const step = Math.max(0, Math.min(action.payload, state.estimate.maxStepReached));
      state.estimate.currentStep = step;
    },
    setStepErrors(state, action: PayloadAction<Record<string, string>>) {
      state.estimate.errors = action.payload || {};
    },
    clearErrors(state) {
      state.estimate.errors = {};
    },

    /* ------------------------------ vehicle ----------------------------- */
    setVehicleType(state, action: PayloadAction<EstimateState['vehicle']['type']>) {
      state.estimate.vehicle.type = action.payload;
      markDirty(state);
    },
    updateVehicle(state, action: PayloadAction<Partial<EstimateState['vehicle']>>) {
      state.estimate.vehicle = { ...state.estimate.vehicle, ...action.payload };
      markDirty(state);
    },

    /* ----------------------------- customer ----------------------------- */
    updateCustomer(state, action: PayloadAction<Partial<Customer>>) {
      state.estimate.customer = { ...state.estimate.customer, ...action.payload };
      markDirty(state);
    },
    selectCustomer(state, action: PayloadAction<{ customer: Partial<Customer>; replace?: boolean }>) {
      const base = action.payload.replace ? createEmptyEstimate(state.config).customer : state.estimate.customer;
      state.estimate.customer = { ...base, ...action.payload.customer };
      markDirty(state);
    },
    resetCustomer(state) {
      state.estimate.customer = createEmptyEstimate(state.config).customer;
      markDirty(state);
    },

    /* ---------------------------- insurance ----------------------------- */
    updateInsurance(state, action: PayloadAction<Partial<EstimateState['insurance']>>) {
      state.estimate.insurance = { ...state.estimate.insurance, ...action.payload };
      markDirty(state);
    },
    setInsuranceDocument(state, action: PayloadAction<UploadedDocument | null>) {
      state.estimate.insurance.document = action.payload;
      markDirty(state);
    },

    /* ---------------------------- documents ----------------------------- */
    updateDocument(
      state,
      action: PayloadAction<{ key: 'rc' | 'puc' | 'license'; patch: Partial<EstimateState['documents']['rc']> }>
    ) {
      const { key, patch } = action.payload;
      state.estimate.documents[key] = { ...state.estimate.documents[key], ...patch };
      markDirty(state);
    },

    /* -------------------------- identity proof -------------------------- */
    updateIdentityProof(state, action: PayloadAction<Partial<EstimateState['identityProof']>>) {
      state.estimate.identityProof = { ...state.estimate.identityProof, ...action.payload };
      markDirty(state);
    },
    setIdentityDocument(state, action: PayloadAction<UploadedDocument | null>) {
      state.estimate.identityProof.document = action.payload;
      markDirty(state);
    },

    /* ------------------------------ pickup ------------------------------ */
    updatePickup(state, action: PayloadAction<Partial<EstimateState['pickup']>>) {
      state.estimate.pickup = { ...state.estimate.pickup, ...action.payload };
      markDirty(state);
    },

    /* ------------------------- booking / complaint ---------------------- */
    setBookingSource(state, action: PayloadAction<string>) {
      state.estimate.bookingSource = action.payload;
      markDirty(state);
    },
    setComplaint(state, action: PayloadAction<string>) {
      state.estimate.complaint = action.payload;
      markDirty(state);
    },
    setNotes(state, action: PayloadAction<string>) {
      state.estimate.notes = action.payload;
      markDirty(state);
    },
    setTerms(state, action: PayloadAction<string>) {
      state.estimate.terms = action.payload;
      markDirty(state);
    },

    /* ---------------------------- inspection ---------------------------- */
    setInspectionCategories(state, action: PayloadAction<InspectionCategory[]>) {
      state.estimate.inspection = action.payload;
      markDirty(state);
    },
    setInspectionStatus(
      state,
      action: PayloadAction<{ categoryId: string; itemId: string; status: InspectionStatus }>
    ) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      const item = category?.items.find((i) => i.id === action.payload.itemId);
      if (item) item.status = action.payload.status;
      markDirty(state);
    },
    /** Set every item in a category at once — a big time saver on inspection. */
    setCategoryStatus(
      state,
      action: PayloadAction<{ categoryId: string; status: InspectionStatus; onlyUnset?: boolean }>
    ) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      if (!category) return;
      for (const item of category.items) {
        if (action.payload.onlyUnset && item.status !== 'na') continue;
        item.status = action.payload.status;
      }
      markDirty(state);
    },
    setInspectionNotes(
      state,
      action: PayloadAction<{ categoryId: string; itemId: string; notes: string }>
    ) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      const item = category?.items.find((i) => i.id === action.payload.itemId);
      if (item) item.notes = action.payload.notes;
      markDirty(state);
    },
    /**
     * The MediaUploader owns the upload lifecycle and reports the whole array
     * back, so a single action keeps the tree in sync (including progress).
     */
    setInspectionMedia(
      state,
      action: PayloadAction<{ categoryId: string; itemId: string; media: MediaAttachment[] }>
    ) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      const item = category?.items.find((i) => i.id === action.payload.itemId);
      if (item) item.media = action.payload.media;
      markDirty(state);
    },
    addInspectionCategory(state, action: PayloadAction<InspectionCategory>) {
      state.estimate.inspection.push(action.payload);
      markDirty(state);
    },
    updateInspectionCategory(
      state,
      action: PayloadAction<{ categoryId: string; patch: Partial<InspectionCategory> }>
    ) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      if (category) Object.assign(category, action.payload.patch);
      markDirty(state);
    },
    removeInspectionCategory(state, action: PayloadAction<string>) {
      state.estimate.inspection = state.estimate.inspection.filter((c) => c.id !== action.payload);
      markDirty(state);
    },
    addInspectionItem(state, action: PayloadAction<{ categoryId: string; itemName: string }>) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      if (!category) return;
      category.items.push({
        id: newId('insp'),
        categoryId: category.id,
        name: action.payload.itemName,
        status: 'na',
        notes: '',
        media: [],
        linkedServiceIds: [],
      });
      markDirty(state);
    },
    removeInspectionItem(state, action: PayloadAction<{ categoryId: string; itemId: string }>) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      if (category) category.items = category.items.filter((i) => i.id !== action.payload.itemId);
      markDirty(state);
    },

    /* ---------------------------- line items ---------------------------- */
    addLineItem(state, action: PayloadAction<EstimateLineItem>) {
      state.estimate.lineItems.push(action.payload);
      recalculate(state);
    },
    addLineItems(state, action: PayloadAction<EstimateLineItem[]>) {
      state.estimate.lineItems.push(...action.payload);
      recalculate(state);
    },
    updateLineItem(state, action: PayloadAction<{ id: string; patch: Partial<EstimateLineItem> }>) {
      const index = state.estimate.lineItems.findIndex((i) => i.id === action.payload.id);
      if (index === -1) return;
      state.estimate.lineItems[index] = { ...state.estimate.lineItems[index], ...action.payload.patch };
      recalculate(state);
    },
    removeLineItem(state, action: PayloadAction<string>) {
      state.estimate.lineItems = state.estimate.lineItems.filter((i) => i.id !== action.payload);
      // Deleted items must disappear from totals immediately, including any
      // inspection traceability pointing at them.
      for (const category of state.estimate.inspection) {
        for (const item of category.items) {
          if (item.linkedServiceIds?.includes(action.payload)) {
            item.linkedServiceIds = item.linkedServiceIds.filter((id) => id !== action.payload);
          }
        }
      }
      recalculate(state);
    },
    duplicateLineItem(state, action: PayloadAction<string>) {
      const source = state.estimate.lineItems.find((i) => i.id === action.payload);
      if (!source) return;
      state.estimate.lineItems.push({
        ...source,
        id: newId('item'),
        name: `${source.name} (copy)`,
        // A duplicate is a fresh recommendation, not a linked defect.
        inspectionItemId: undefined,
        inspectionItemName: undefined,
        inspectionCategoryName: undefined,
      });
      recalculate(state);
    },
    clearLineItems(state) {
      state.estimate.lineItems = [];
      recalculate(state);
    },
    /**
     * Link a catalogue item to the inspection defect that recommended it. The
     * relationship is stored on both sides so the estimate stays traceable.
     */
    linkServiceToInspection(
      state,
      action: PayloadAction<{ categoryId: string; itemId: string; lineItemId: string }>
    ) {
      const category = findCategory(state.estimate, action.payload.categoryId);
      const item = category?.items.find((i) => i.id === action.payload.itemId);
      if (!item) return;
      item.linkedServiceIds = [...(item.linkedServiceIds || []), action.payload.lineItemId];
      markDirty(state);
    },

    /* ------------------------------ payments ---------------------------- */
    addPayment(state, action: PayloadAction<AdvancePayment>) {
      state.estimate.payments.push(action.payload);
      recalculate(state);
    },
    addLocalAdvance(state, action: PayloadAction<Parameters<typeof localAdvance>[0]>) {
      state.estimate.payments.push(localAdvance(action.payload));
      recalculate(state);
    },
    removePayment(state, action: PayloadAction<string>) {
      state.estimate.payments = state.estimate.payments.filter((p) => p.id !== action.payload);
      recalculate(state);
    },
    setPayments(state, action: PayloadAction<AdvancePayment[]>) {
      state.estimate.payments = action.payload;
      recalculate(state);
    },

    /* ------------------------------ metadata ---------------------------- */
    setMetadata(state, action: PayloadAction<Partial<EstimateState['metadata']>>) {
      state.estimate.metadata = { ...state.estimate.metadata, ...action.payload };
    },
    setStatus(state, action: PayloadAction<EstimateState['status']>) {
      state.estimate.status = action.payload;
    },

    /* ---------------------------- persistence --------------------------- */
    setConfig(state, action: PayloadAction<EstimateBusinessConfig>) {
      state.config = action.payload;
      if (!state.estimate.metadata.validUntil) {
        state.estimate.metadata.validUntil = addDays(action.payload.validUntilDays);
      }
      recalculate(state, { dirty: false });
    },
    setDraftId(state, action: PayloadAction<string | null>) {
      state.estimate.draftId = action.payload;
    },
    hydrateEstimate(state, action: PayloadAction<Partial<EstimateState>>) {
      const base = createEmptyEstimate(state.config);
      state.estimate = mergePartial(base, action.payload);
      recalculate(state, { dirty: false });
    },
    markClean(state) {
      state.estimate.dirty = false;
    },
    setSaveState(state, action: PayloadAction<EstimateState['saveState']>) {
      state.estimate.saveState = action.payload;
    },
    setDraftNotice(state, action: PayloadAction<string | null>) {
      state.draftNotice = action.payload;
    },
    setLoadingDraft(state, action: PayloadAction<boolean>) {
      state.estimate.loadingDraft = action.payload;
    },
    resetEstimate(state) {
      const config = state.config;
      state.estimate = createEmptyEstimate(config);
      state.draftNotice = null;
      state.persistence = 'none';
      recalculate(state, { dirty: false });
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(saveDraft.pending, (state) => {
        state.estimate.saveState = 'saving';
      })
      .addCase(saveDraft.fulfilled, (state, action) => {
        state.estimate.saveState = 'saved';
        state.estimate.lastSavedAt = action.payload.savedAt;
        state.estimate.metadata.lastSavedAt = action.payload.savedAt;
        state.persistence = action.payload.persistence;
        if (action.payload.id && action.payload.id !== state.estimate.draftId) {
          state.estimate.draftId = action.payload.id;
        }
        if (action.payload.ok) {
          state.estimate.dirty = false;
        } else {
          state.draftNotice = action.payload.message || 'Saved locally. The server is unreachable.';
        }
      })
      .addCase(saveDraft.rejected, (state) => {
        state.estimate.saveState = 'error';
      })

      .addCase(loadEstimate.pending, (state) => {
        state.estimate.loadingDraft = true;
      })
      .addCase(loadEstimate.fulfilled, (state, action) => {
        state.estimate.loadingDraft = false;
        if (action.payload) {
          const base = createEmptyEstimate(state.config);
          state.estimate = mergePartial(base, action.payload);
          recalculate(state, { dirty: false });
        }
      })
      .addCase(loadEstimate.rejected, (state) => {
        state.estimate.loadingDraft = false;
      })

      .addCase(loadBusinessConfig.fulfilled, (state, action) => {
        state.config = action.payload;
        recalculate(state, { dirty: false });
      })

      .addCase(generateEstimate.pending, (state) => {
        state.estimate.generating = true;
      })
      .addCase(generateEstimate.fulfilled, (state, action) => {
        state.estimate.generating = false;
        state.estimate.generated = true;
        state.estimate.dirty = false;
        state.estimate.saveState = 'saved';
        const doc = action.payload?.doc;
        if (doc) {
          const partial = estimateService.fromApiDocument(doc);
          if (partial.metadata) state.estimate.metadata = { ...state.estimate.metadata, ...partial.metadata };
          state.estimate.status = partial.status || 'Generated';
          if (partial.payments) state.estimate.payments = partial.payments;
          if (partial.lineItems?.length) state.estimate.lineItems = partial.lineItems;
          state.estimate.draftId = action.payload.id || state.estimate.draftId;
          state.estimate.metadata.generatedAt = new Date().toISOString();
          recalculate(state, { dirty: false });
        }
      })
      .addCase(generateEstimate.rejected, (state) => {
        state.estimate.generating = false;
      });
  },
});

export const {
  setCurrentStep,
  advanceStep,
  goBackStep,
  markStepComplete,
  jumpToStep,
  setStepErrors,
  clearErrors,
  setVehicleType,
  updateVehicle,
  updateCustomer,
  selectCustomer,
  resetCustomer,
  updateInsurance,
  setInsuranceDocument,
  updateDocument,
  updateIdentityProof,
  setIdentityDocument,
  updatePickup,
  setBookingSource,
  setComplaint,
  setNotes,
  setTerms,
  setInspectionCategories,
  setInspectionStatus,
  setCategoryStatus,
  setInspectionNotes,
  setInspectionMedia,
  addInspectionCategory,
  updateInspectionCategory,
  removeInspectionCategory,
  addInspectionItem,
  removeInspectionItem,
  addLineItem,
  addLineItems,
  updateLineItem,
  removeLineItem,
  duplicateLineItem,
  clearLineItems,
  linkServiceToInspection,
  addPayment,
  addLocalAdvance,
  removePayment,
  setPayments,
  setMetadata,
  setStatus,
  setConfig,
  setDraftId,
  hydrateEstimate,
  markClean,
  setSaveState,
  setDraftNotice,
  setLoadingDraft,
  resetEstimate,
} = estimateSlice.actions;

/* ------------------------------- selectors ------------------------------- */

export const selectEstimateRoot = (state: RootState) => state.estimate;
export const selectEstimate = (state: RootState) => state.estimate.estimate;
export const selectEstimateConfig = (state: RootState) => state.estimate.config;
export const selectDocumentStatuses = (state: RootState) =>
  deriveDocumentStatus(state.estimate.estimate, state.estimate.config);
export const selectInspectionProgress = (state: RootState) => {
  const categories = state.estimate.estimate.inspection || [];
  let total = 0;
  let inspected = 0;
  for (const category of categories) {
    for (const item of category.items || []) {
      total += 1;
      if (item.status !== 'na') inspected += 1;
    }
  }
  return { total, inspected, percent: total ? Math.round((inspected / total) * 100) : 0 };
};

export default estimateSlice.reducer;
