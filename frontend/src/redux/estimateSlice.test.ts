// ---------------------------------------------------------------------------
// Tests for the centralised estimate slice.
//
// These are the workflow invariants the four steps depend on: data survives
// navigation, every money change recalculates the totals, deleted items vanish
// from the totals immediately, and inspection links stay traceable.
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import estimateReducer, {
  type EstimateSliceState,
  addInspectionCategory,
  addInspectionItem,
  addLineItem,
  addLineItems,
  addLocalAdvance,
  addPayment,
  advanceStep,
  clearLineItems,
  createEmptyEstimate,
  createInitialSliceState,
  duplicateLineItem,
  goBackStep,
  hydrateEstimate,
  jumpToStep,
  linkServiceToInspection,
  loadBusinessConfig,
  removeInspectionCategory,
  removeLineItem,
  removePayment,
  resetEstimate,
  selectInspectionProgress,
  setCategoryStatus,
  setConfig,
  setCurrentStep,
  setInspectionMedia,
  setInspectionNotes,
  setInspectionStatus,
  setStepErrors,
  clearErrors,
  updateCustomer,
  updateLineItem,
  updateVehicle,
  setInsuranceDocument,
  updatePickup,
} from './estimateSlice';
import { DEFAULT_BUSINESS_CONFIG } from '../services/estimate/config';
import { defaultCategories } from '../services/estimate/inspectionService';
import type {
  AdvancePayment,
  EstimateLineItem,
  InspectionCategory,
} from '../services/estimate/types';

type State = EstimateSliceState;

const init = (): State => createInitialSliceState() as unknown as State;

function reduce(state: State, action: any): State {
  return estimateReducer(state as any, action) as unknown as State;
}

function lineItem(overrides: Partial<EstimateLineItem> = {}): EstimateLineItem {
  return {
    id: 'item-1',
    type: 'service',
    name: 'Brake Pad Replacement',
    unit: 'Job',
    quantity: 1,
    rate: 1000,
    discountType: 'none',
    discountValue: 0,
    taxType: 'GST',
    taxRate: 18,
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    total: 0,
    ...overrides,
  };
}

function firstInspection(state: State): InspectionCategory {
  return state.estimate.inspection[0];
}

describe('initial state', () => {
  it('starts on step 1 with a draft, seeded inspection categories and zero totals', () => {
    const state = init();

    expect(state.estimate.currentStep).toBe(0);
    expect(state.estimate.maxStepReached).toBe(0);
    expect(state.estimate.status).toBe('Draft');
    expect(state.estimate.dirty).toBe(false);
    expect(state.estimate.inspection.length).toBeGreaterThan(0);
    expect(state.estimate.lineItems).toEqual([]);
    expect(state.estimate.totals.grandTotal).toBe(0);
    expect(state.changeSeq).toBe(0);
  });

  it('seeds the default inspection categories and points', () => {
    const state = init();
    const names = state.estimate.inspection.map((c) => c.name);

    expect(names).toEqual(expect.arrayContaining(['Road Test', 'Exterior / Interior', 'Mechanical']));
    expect(firstInspection(state).items.some((i) => i.name === 'Engine Performance')).toBe(true);
    for (const category of state.estimate.inspection) {
      for (const item of category.items) {
        expect(item.status).toBe('na');
        expect(item.linkedServiceIds).toEqual([]);
      }
    }
  });
});

describe('step navigation', () => {
  it('marks the previous step complete and unlocks the next one', () => {
    let state = init();
    state = reduce(state, advanceStep());

    expect(state.estimate.currentStep).toBe(1);
    expect(state.estimate.maxStepReached).toBe(1);
    expect(state.estimate.completedSteps).toEqual([0]);
  });

  it('refuses to skip ahead to a step that has not been unlocked', () => {
    const state = reduce(init(), setCurrentStep(3));
    expect(state.estimate.currentStep).toBe(0);
  });

  it('allows jumping back to any unlocked step', () => {
    let state = init();
    state = reduce(state, advanceStep());
    state = reduce(state, advanceStep());
    expect(state.estimate.maxStepReached).toBe(2);

    state = reduce(state, jumpToStep(1));
    expect(state.estimate.currentStep).toBe(1);

    state = reduce(state, jumpToStep(3));
    expect(state.estimate.currentStep).toBe(2);
  });

  it('never steps before the first or past the last step', () => {
    let state = init();
    state = reduce(state, goBackStep());
    expect(state.estimate.currentStep).toBe(0);

    for (let i = 0; i < 10; i += 1) state = reduce(state, advanceStep());
    expect(state.estimate.currentStep).toBe(3);
  });

  it('records and clears field errors', () => {
    let state = reduce(init(), setStepErrors({ 'customer.phone': 'Customer phone number is required' }));
    expect(state.estimate.errors).toEqual({ 'customer.phone': 'Customer phone number is required' });

    state = reduce(state, clearErrors());
    expect(state.estimate.errors).toEqual({});
  });

  it('keeps entered data when moving between steps', () => {
    let state = init();
    state = reduce(state, updateCustomer({ name: 'Rahul Sharma', phone: '9876543210' }));
    state = reduce(state, updateVehicle({ registrationNumber: 'MH12AB1234' }));

    state = reduce(state, advanceStep());
    state = reduce(state, goBackStep());

    expect(state.estimate.customer.name).toBe('Rahul Sharma');
    expect(state.estimate.customer.phone).toBe('9876543210');
    expect(state.estimate.vehicle.registrationNumber).toBe('MH12AB1234');
  });
});

describe('dirty tracking / autosave trigger', () => {
  it('bumps changeSeq and flags the draft dirty on an edit', () => {
    const state = reduce(init(), updateCustomer({ name: 'Rahul' }));

    expect(state.estimate.dirty).toBe(true);
    expect(state.estimate.saveState).toBe('idle');
    expect(state.changeSeq).toBe(1);
  });

  it('does not bump changeSeq for a non-edit action', () => {
    let state = reduce(init(), updateCustomer({ name: 'Rahul' }));
    const before = state.changeSeq;
    state = reduce(state, setCurrentStep(0));
    expect(state.changeSeq).toBe(before);
  });
});

describe('line items', () => {
  it('adds an item and calculates its money immediately', () => {
    const state = reduce(init(), addLineItem(lineItem({ rate: 2500 })));
    const [item] = state.estimate.lineItems;

    expect(state.estimate.lineItems).toHaveLength(1);
    expect(item.subtotal).toBe(2500);
    expect(item.taxAmount).toBe(450);
    expect(item.total).toBe(2950);
    expect(state.estimate.totals.grandTotal).toBe(2950);
  });

  it('recalculates when an item is edited', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 1000 })));
    state = reduce(state, updateLineItem({ id: 'item-1', patch: { quantity: 3 } }));

    expect(state.estimate.lineItems[0].subtotal).toBe(3000);
    expect(state.estimate.totals.grandTotal).toBe(3540);
  });

  it('ignores an edit to an unknown item', () => {
    const state = reduce(init(), updateLineItem({ id: 'nope', patch: { quantity: 9 } }));
    expect(state.estimate.lineItems).toEqual([]);
  });

  it('removes an item from the totals immediately', () => {
    let state = reduce(init(), addLineItems([lineItem({ id: 'a', rate: 1000 }), lineItem({ id: 'b', rate: 2000 })]));
    expect(state.estimate.totals.grandTotal).toBe(3540);

    state = reduce(state, removeLineItem('b'));
    expect(state.estimate.lineItems).toHaveLength(1);
    expect(state.estimate.totals.grandTotal).toBe(1180);
  });

  it('duplicates an item as a fresh row', () => {
    let state = reduce(init(), addLineItem(lineItem({ id: 'a', rate: 1000 })));
    state = reduce(state, duplicateLineItem('a'));

    expect(state.estimate.lineItems).toHaveLength(2);
    const copy = state.estimate.lineItems[1];
    expect(copy.id).not.toBe('a');
    expect(copy.name).toBe('Brake Pad Replacement (copy)');
    expect(state.estimate.totals.grandTotal).toBe(2360);
  });

  it('does not duplicate an unknown item', () => {
    const state = reduce(init(), duplicateLineItem('nope'));
    expect(state.estimate.lineItems).toEqual([]);
  });

  it('clears every item and the totals', () => {
    let state = reduce(init(), addLineItems([lineItem({ id: 'a' }), lineItem({ id: 'b' })]));
    state = reduce(state, clearLineItems());

    expect(state.estimate.lineItems).toEqual([]);
    expect(state.estimate.totals.grandTotal).toBe(0);
  });

  it('lets the same service be added twice (duplicate services are allowed)', () => {
    let state = reduce(init(), addLineItem(lineItem({ id: 'a', name: 'Brake Pad Replacement' })));
    state = reduce(state, addLineItem(lineItem({ id: 'b', name: 'Brake Pad Replacement' })));

    expect(state.estimate.lineItems).toHaveLength(2);
    expect(state.estimate.totals.grandTotal).toBe(2360);
  });

  it('deletes the inspection link when the linked item is removed', () => {
    let state = init();
    const category = firstInspection(state);
    const item = category.items[0];

    state = reduce(state, addLineItem(lineItem({ id: 'a' })));
    state = reduce(state, linkServiceToInspection({ categoryId: category.id, itemId: item.id, lineItemId: 'a' }));
    expect(firstInspection(state).items[0].linkedServiceIds).toEqual(['a']);

    state = reduce(state, removeLineItem('a'));
    expect(firstInspection(state).items[0].linkedServiceIds).toEqual([]);
  });

  it('normalises a negative quantity or rate instead of crediting the customer', () => {
    const state = reduce(init(), addLineItem(lineItem({ quantity: -5, rate: -100 })));

    expect(state.estimate.lineItems[0].subtotal).toBe(0);
    expect(state.estimate.totals.grandTotal).toBe(0);
  });
});

describe('inspection', () => {
  it('records a status, notes and media per point', () => {
    let state = init();
    const category = firstInspection(state);
    const item = category.items[0];

    state = reduce(state, setInspectionStatus({ categoryId: category.id, itemId: item.id, status: 'critical' }));
    state = reduce(state, setInspectionNotes({ categoryId: category.id, itemId: item.id, notes: 'Squealing under braking' }));
    state = reduce(
      state,
      setInspectionMedia({
        categoryId: category.id,
        itemId: item.id,
        media: [
          {
            id: 'm1',
            name: 'pad.jpg',
            kind: 'photo',
            mimeType: 'image/jpeg',
            size: 1024,
            uploadState: 'done',
            progress: 100,
            uploadedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    );

    const updated = firstInspection(state).items[0];
    expect(updated.status).toBe('critical');
    expect(updated.notes).toBe('Squealing under braking');
    expect(updated.media).toHaveLength(1);
  });

  it('keeps notes when navigating away and back', () => {
    let state = init();
    const category = firstInspection(state);
    const item = category.items[0];

    state = reduce(state, setInspectionNotes({ categoryId: category.id, itemId: item.id, notes: 'Check' }));
    state = reduce(state, advanceStep());
    state = reduce(state, advanceStep());
    state = reduce(state, goBackStep());

    expect(firstInspection(state).items[0].notes).toBe('Check');
  });

  it('sets every point in a category at once', () => {
    let state = init();
    const category = firstInspection(state);
    state = reduce(state, setCategoryStatus({ categoryId: category.id, status: 'good' }));

    expect(firstInspection(state).items.every((i) => i.status === 'good')).toBe(true);
  });

  it('can leave already-inspected points untouched', () => {
    let state = init();
    const category = firstInspection(state);
    const inspected = category.items[0];
    state = reduce(state, setInspectionStatus({ categoryId: category.id, itemId: inspected.id, status: 'critical' }));
    state = reduce(state, setCategoryStatus({ categoryId: category.id, status: 'good', onlyUnset: true }));

    const updated = firstInspection(state);
    expect(updated.items.find((i) => i.id === inspected.id)?.status).toBe('critical');
    expect(updated.items.filter((i) => i.status === 'good').length).toBe(updated.items.length - 1);
  });

  it('adds and removes custom categories and points', () => {
    let state = init();
    const custom: InspectionCategory = {
      id: 'cat-custom',
      name: 'Tyres',
      description: 'Tread depth',
      sortOrder: 99,
      isActive: true,
      isCustom: true,
      items: [],
    };

    state = reduce(state, addInspectionCategory(custom));
    expect(state.estimate.inspection.map((c) => c.id)).toContain('cat-custom');

    state = reduce(state, addInspectionItem({ categoryId: 'cat-custom', itemName: 'Tread depth — front' }));
    const created = state.estimate.inspection.find((c) => c.id === 'cat-custom')!;
    expect(created.items).toHaveLength(1);
    expect(created.items[0].name).toBe('Tread depth — front');
    expect(created.items[0].status).toBe('na');

    state = reduce(state, removeInspectionCategory('cat-custom'));
    expect(state.estimate.inspection.map((c) => c.id)).not.toContain('cat-custom');
  });

  it('reports inspection progress from the selector', () => {
    let state = init();
    const total = state.estimate.inspection.reduce((sum, c) => sum + c.items.length, 0);
    const root = (sliceState: State) => ({ estimate: sliceState }) as any;

    expect(selectInspectionProgress(root(state))).toEqual({ total, inspected: 0, percent: 0 });

    const category = firstInspection(state);
    state = reduce(state, setInspectionStatus({ categoryId: category.id, itemId: category.items[0].id, status: 'good' }));
    expect(selectInspectionProgress(root(state)).inspected).toBe(1);
    expect(selectInspectionProgress(root(state)).percent).toBe(Math.round((1 / total) * 100));
  });
});

describe('inspection → service traceability', () => {
  it('links both sides so the estimate can explain the recommendation', () => {
    let state = init();
    const category = firstInspection(state);
    const item = category.items[0];

    state = reduce(state, addLineItem(lineItem({ id: 'svc-1', name: 'Brake Pad Replacement' })));
    state = reduce(state, linkServiceToInspection({ categoryId: category.id, itemId: item.id, lineItemId: 'svc-1' }));

    expect(firstInspection(state).items[0].linkedServiceIds).toContain('svc-1');
    expect(state.estimate.lineItems[0].id).toBe('svc-1');
  });

  it('does not link to a point that does not exist', () => {
    let state = reduce(init(), addLineItem(lineItem({ id: 'svc-1' })));
    state = reduce(state, linkServiceToInspection({ categoryId: 'nope', itemId: 'nope', lineItemId: 'svc-1' }));
    expect(state.estimate.lineItems).toHaveLength(1);
  });
});

describe('advance payments', () => {
  function payment(amount: number, id = `pay-${amount}`): AdvancePayment {
    return {
      id,
      amount,
      mode: 'UPI',
      date: '2026-01-01',
      reference: 'REF',
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('records an advance and reduces the balance due', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 10000 })));
    state = reduce(state, addPayment(payment(10000)));

    expect(state.estimate.totals.grandTotal).toBe(11800);
    expect(state.estimate.totals.advancePaid).toBe(10000);
    expect(state.estimate.totals.balanceDue).toBe(1800);
  });

  it('supports multiple advances', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 10000 })));
    state = reduce(state, addPayment(payment(5000, 'p1')));
    state = reduce(state, addLocalAdvance({ amount: 2000, mode: 'Cash', date: '2026-01-02' }));

    expect(state.estimate.payments).toHaveLength(2);
    expect(state.estimate.totals.advancePaid).toBe(7000);
    expect(state.estimate.totals.balanceDue).toBe(4800);
  });

  it('removes an advance and recalculates the balance', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 10000 })));
    state = reduce(state, addPayment(payment(5000, 'p1')));
    state = reduce(state, removePayment('p1'));

    expect(state.estimate.payments).toEqual([]);
    expect(state.estimate.totals.advancePaid).toBe(0);
    expect(state.estimate.totals.balanceDue).toBe(11800);
  });

  it('recalculates the balance when an item changes after an advance was taken', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 10000 })));
    state = reduce(state, addPayment(payment(1000)));
    state = reduce(state, updateLineItem({ id: 'item-1', patch: { rate: 20000 } }));

    expect(state.estimate.totals.grandTotal).toBe(23600);
    expect(state.estimate.totals.balanceDue).toBe(22600);
  });
});

describe('configuration', () => {
  it('applies a server config and recalculates the totals', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 1000, taxType: 'GST', taxRate: 18 })));
    state = reduce(state, setConfig({ ...DEFAULT_BUSINESS_CONFIG, advanceMaxPercent: 50 }));

    expect(state.config.advanceMaxPercent).toBe(50);
    expect(state.estimate.totals.grandTotal).toBe(1180);
  });

  it('switches to inter-state supply so IGST replaces CGST/SGST', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 1000, taxType: 'GST', taxRate: 18 })));
    state = reduce(state, setConfig({ ...DEFAULT_BUSINESS_CONFIG, supplyType: 'inter' }));

    expect(state.estimate.totals.igst).toBe(180);
    expect(state.estimate.totals.cgst).toBe(0);
    expect(state.estimate.totals.sgst).toBe(0);
  });

  it('honours the round-off switch', () => {
    let state = reduce(init(), addLineItem(lineItem({ rate: 8469.15, taxType: 'GST', taxRate: 18 })));
    expect(state.estimate.totals.grandTotal).toBe(9994);

    state = reduce(state, setConfig({ ...DEFAULT_BUSINESS_CONFIG, roundOffEnabled: false }));
    expect(state.estimate.totals.grandTotal).toBe(9993.6);
  });

  it('does not flag a config change as a user edit', () => {
    const state = reduce(init(), setConfig({ ...DEFAULT_BUSINESS_CONFIG }));
    expect(state.estimate.dirty).toBe(false);
  });

  it('accepts the business config loaded by the thunk', () => {
    const state = reduce(init(), {
      type: loadBusinessConfig.fulfilled.type,
      payload: { ...DEFAULT_BUSINESS_CONFIG, estimatePrefix: 'QTE' },
    });
    expect(state.config.estimatePrefix).toBe('QTE');
  });
});

describe('hydrate / reset', () => {
  it('merges a partial payload onto fresh defaults', () => {
    const state = reduce(init(), hydrateEstimate({ customer: { name: 'Rahul', phone: '9876543210' } }));

    expect(state.estimate.customer.name).toBe('Rahul');
    expect(state.estimate.customer.phone).toBe('9876543210');
    // Untouched sections fall back to defaults rather than becoming undefined.
    expect(state.estimate.vehicle.type).toBe('4W');
    expect(state.estimate.documents.rc).toBeDefined();
    expect(state.estimate.insurance.document).toBeNull();
    expect(state.estimate.totals.grandTotal).toBe(0);
    expect(state.estimate.dirty).toBe(false);
  });

  it('recalculates the totals of a hydrated draft', () => {
    const state = reduce(init(), hydrateEstimate({ lineItems: [lineItem({ id: 'a', rate: 1000 })] }));

    expect(state.estimate.lineItems[0].taxAmount).toBe(180);
    expect(state.estimate.totals.grandTotal).toBe(1180);
  });

  it('seeds default inspection categories when a payload has none', () => {
    const state = reduce(init(), hydrateEstimate({ inspection: [] }));
    expect(state.estimate.inspection.length).toBe(defaultCategories().length);
  });

  it('keeps a hydrated inspection payload', () => {
    const categories = [
      { id: 'c1', name: 'Custom', sortOrder: 0, isActive: true, items: [] } as InspectionCategory,
    ];
    const state = reduce(init(), hydrateEstimate({ inspection: categories }));
    expect(state.estimate.inspection).toEqual(categories);
  });

  it('resets back to a clean draft but keeps the business config', () => {
    let state = reduce(init(), setConfig({ ...DEFAULT_BUSINESS_CONFIG, estimatePrefix: 'QTE' }));
    state = reduce(state, updateCustomer({ name: 'Rahul' }));
    state = reduce(state, addLineItem(lineItem({ id: 'a' })));
    state = reduce(state, addPayment({ id: 'p', amount: 100, mode: 'Cash', date: '2026-01-01', createdAt: 'x' }));
    state = reduce(state, updateVehicle({ registrationNumber: 'MH12AB1234' }));
    state = reduce(state, updatePickup({ enabled: true, address: 'Pune' }));
    state = reduce(state, setInsuranceDocument({ id: 'd' } as any));
    state = reduce(state, resetEstimate());

    expect(state.estimate.customer.name).toBe('');
    expect(state.estimate.vehicle.registrationNumber).toBe('');
    expect(state.estimate.lineItems).toEqual([]);
    expect(state.estimate.payments).toEqual([]);
    expect(state.estimate.pickup.enabled).toBe(false);
    expect(state.estimate.insurance.document).toBeNull();
    expect(state.estimate.totals.grandTotal).toBe(0);
    expect(state.estimate.currentStep).toBe(0);
    expect(state.config.estimatePrefix).toBe('QTE');
  });
});

describe('draft recovery', () => {
  it('starts every fresh draft from the same shape', () => {
    expect(createEmptyEstimate()).toMatchObject({
      currentStep: 0,
      status: 'Draft',
      dirty: false,
      generated: false,
      lineItems: [],
    });
  });

  it('does not require an enabled compliance reminder by default', () => {
    const empty = createEmptyEstimate();
    expect(empty.documents.rc.setReminder).toBe(false);
    expect(empty.documents.puc.setReminder).toBe(false);
    expect(empty.documents.license.setReminder).toBe(false);
  });
});
