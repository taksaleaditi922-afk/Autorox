import JobCard, { STATUS_VALUES, PRIORITIES } from '../models/JobCard.js';

/**
 * GET /api/reports/jobcards?format=json|csv
 * Returns the same filterable dataset as the job cards list without pagination,
 * optionally as CSV for downloading.
 */
export const jobCardReport = async (filters: any): Promise<any> => {
  const format = filters.format || (filters.export ? 'csv' : 'json');
  const filter: Record<string, any> = {};

  if (filters.status && STATUS_VALUES.includes(filters.status)) filter.status = filters.status;
  if (filters.priority && PRIORITIES.includes(filters.priority)) filter['service.priority'] = filters.priority;
  if (filters.from || filters.to) {
    const from = filters.from ? new Date(filters.from) : new Date(0);
    const to = filters.to ? new Date(filters.to) : new Date();
    filter.createdAt = { $gte: from, $lte: to };
  }

  const rows = await JobCard.find(filter)
    .select('jobCardNumber status vehicle customer service advisor insurance createdAt updatedAt')
    .sort('-createdAt');

  if (format === 'csv') {
    const header = [
      'JobCardNumber',
      'Status',
      'RegNo',
      'Make',
      'Model',
      'Customer',
      'Phone',
      'ServiceType',
      'Priority',
      'EstimatedDelivery',
      'ActualDelivery',
      'InsuranceClaim',
      'Advisor',
      'CreatedAt',
    ];
    const csvEscape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [
        r.jobCardNumber,
        r.status,
        r.vehicle?.registrationNumber,
        r.vehicle?.make,
        r.vehicle?.model,
        r.customer?.name,
        r.customer?.phone,
        r.service?.type,
        r.service?.priority,
        r.service?.estimatedDelivery?.toISOString?.() || '',
        r.service?.actualDelivery?.toISOString?.() || '',
        r.insurance?.isClaim ? 'Yes' : 'No',
        r.advisor?.name,
        r.createdAt?.toISOString?.() || '',
      ]
        .map(csvEscape)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    return { format: "csv", csv };
  }
  return { success: true, data: rows, count: rows.length };
};