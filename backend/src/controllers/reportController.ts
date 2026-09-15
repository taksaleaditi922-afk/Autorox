import JobCard, { STATUS_VALUES, PRIORITIES } from '../models/JobCard.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/reports/jobcards?format=json|csv
 * Returns the same filterable dataset as the job cards list without pagination,
 * optionally as CSV for downloading.
 */
export const jobCardReport = asyncHandler(async (req, res) => {
  const format = req.query.format || (req.query.export ? 'csv' : 'json');
  const filter = {};

  if (req.query.status && STATUS_VALUES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.priority && PRIORITIES.includes(req.query.priority)) filter['service.priority'] = req.query.priority;
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(req.query.from) : new Date(0);
    const to = req.query.to ? new Date(req.query.to) : new Date();
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
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="jobcard-report.csv"');
    return res.send(csv);
  }
  return res.json({ success: true, data: rows, count: rows.length });
});