import asyncHandler from '../utils/asyncHandler.js';
import * as service from '../services/reportService.js';

export const jobCardReport = asyncHandler(async (req, res) => {
  const result = await service.jobCardReport(req.query);
  if (result.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="jobcard-report.csv"');
    return res.send(result.csv);
  }
  res.json(result);
});
