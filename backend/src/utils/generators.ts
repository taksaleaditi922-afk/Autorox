/**
 * Generate a pseudo-sequential job card number, e.g. JC-2026-0001.
 * A timestamp-based suffix ensures uniqueness across concurrent calls.
 */
export const generateJobCardNumber = (year = new Date().getFullYear()) => {
  const seq = Date.now().toString().slice(-6);
  return `JC-${year}-${seq}`;
};

/**
 * Generate an estimate number, e.g. EST-2026-000042.
 */export const generateEstimateNumber = (year = new Date().getFullYear()) => {
  const seq = Date.now().toString().slice(-6);
  return `EST-${year}-${seq}`;
};

export const generateBillNumber = (year = new Date().getFullYear(), prefix = 'BIL') => {
  const seq = Date.now().toString().slice(-6);
  return `${prefix}-${year}-${seq}`;
};
