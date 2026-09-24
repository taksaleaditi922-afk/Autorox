// ---------------------------------------------------------------------------
// Tests for the estimate numbering format (EST-2026-000124).
//
// Only the pure helpers are exercised here — the allocating functions need the
// database and are covered by the generate-estimate flow.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

// The installed mongoose package only ships TypeScript sources, which Vitest
// cannot load. The formatters under test never touch the database.
vi.mock('../models/Estimate.js', async () => (await import('./estimateModel.test-support.js')).estimateModelStub());

import { estimateNumberPattern, formatEstimateNumber } from './estimateNumbering.js';

describe('formatEstimateNumber', () => {
  it('builds the documented format', () => {
    expect(formatEstimateNumber('EST', 2026, 124)).toBe('EST-2026-000124');
  });

  it('pads the sequence to six digits', () => {
    expect(formatEstimateNumber('EST', 2026, 1)).toBe('EST-2026-000001');
    expect(formatEstimateNumber('EST', 2026, 999999)).toBe('EST-2026-999999');
    expect(formatEstimateNumber('EST', 2026, 1000000)).toBe('EST-2026-1000000');
  });

  it('honours a configured prefix', () => {
    expect(formatEstimateNumber('QTE', 2027, 7)).toBe('QTE-2027-000007');
  });
});

describe('estimateNumberPattern', () => {
  it('matches the numbers issued for that prefix and year', () => {
    const pattern = estimateNumberPattern('EST', 2026);

    expect(pattern.test('EST-2026-000124')).toBe(true);
    expect(pattern.test('EST-2026-1')).toBe(true);
  });

  it('does not match another year or prefix', () => {
    const pattern = estimateNumberPattern('EST', 2026);

    expect(pattern.test('EST-2025-000124')).toBe(false);
    expect(pattern.test('QTE-2026-000124')).toBe(false);
    expect(pattern.test('XEST-2026-000124')).toBe(false);
  });

  it('escapes regex characters in the prefix', () => {
    const pattern = estimateNumberPattern('ES.T', 2026);

    expect(pattern.test('ES.T-2026-000001')).toBe(true);
    expect(pattern.test('ESXT-2026-000001')).toBe(false);
  });
});
