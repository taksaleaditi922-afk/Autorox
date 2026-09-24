// ---------------------------------------------------------------------------
// Estimate numbering service.
//
// Format: <PREFIX>-<YEAR>-<6 digit sequence>  e.g. EST-2026-000124
// The sequence is derived from the number of estimates already issued for the
// year. Two advisors drafting at the same moment can collide, so callers retry
// using withEstimateNumber() which handles the duplicate key error.
// ---------------------------------------------------------------------------

import Estimate from '../models/Estimate.js';

export function formatEstimateNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

export function estimateNumberPattern(prefix: string, year: number): RegExp {
  return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${year}-\\d+$`);
}

/** Next sequence number for the year (count + 1). */
export async function peekNextEstimateNumber(prefix = 'EST', year = new Date().getFullYear()) {
  const used = await Estimate.countDocuments({ estimateNumber: estimateNumberPattern(prefix, year) });
  return formatEstimateNumber(prefix, year, used + 1);
}

/**
 * Run `create(number)` with a fresh estimate number, retrying on the unique
 * index if another request grabbed the same sequence first.
 */
export async function withEstimateNumber<T>(
  create: (estimateNumber: string) => Promise<T>,
  options: { prefix?: string; year?: number; attempts?: number } = {}
): Promise<T> {
  const prefix = options.prefix || 'EST';
  const year = options.year || new Date().getFullYear();
  const attempts = options.attempts ?? 6;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const sequence = (await Estimate.countDocuments({ estimateNumber: estimateNumberPattern(prefix, year) })) + 1 + attempt;
    const estimateNumber = formatEstimateNumber(prefix, year, sequence);
    try {
      return await create(estimateNumber);
    } catch (err: any) {
      if (err?.code === 11000) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Could not allocate a unique estimate number');
}

export default { formatEstimateNumber, peekNextEstimateNumber, withEstimateNumber, estimateNumberPattern };
