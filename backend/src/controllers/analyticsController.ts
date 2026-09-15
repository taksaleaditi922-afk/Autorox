import JobCard, { JOB_STATUS, STATUS_VALUES } from '../models/JobCard.js';
import Advisor from '../models/Advisor.js';
import asyncHandler from '../utils/asyncHandler.js';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// GET /api/analytics/dashboard?days=7|30|90
export const dashboard = asyncHandler(async (req, res) => {
  const range = Math.min(parseInt(req.query.days, 10) || 30, 365);
  const from = daysAgo(range);
  const today = startOfToday();

  const [
    totalActive,
    pendingApprovals,
    completedToday,
    completedThisMonth,
    avgTurnaroundAgg,
    statusDist,
    serviceDist,
    trend,
    totalCards,
  ] = await Promise.all([
    JobCard.countDocuments({ status: { $nin: [JOB_STATUS.DELIVERED, JOB_STATUS.CANCELLED] } }),
    JobCard.countDocuments({ status: JOB_STATUS.PENDING_APPROVAL }),
    JobCard.countDocuments({
      'service.actualDelivery': { $gte: today },
    }),
    JobCard.countDocuments({
      'service.actualDelivery': { $gte: daysAgo(30) },
    }),
    JobCard.aggregate([
      {
        $project: {
          turne: {
            $subtract: [
              '$service.actualDelivery',
              '$createdAt',
            ],
          },
        },
      },
      { $match: { turne: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$turne' } } },
    ]),
    JobCard.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    JobCard.aggregate([{ $group: { _id: '$service.type', count: { $sum: 1 } } }]),
    JobCard.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    JobCard.countDocuments(),
  ]);

  const avgMs = avgTurnaroundAgg?.[0]?.avg || 0; // placeholder if no deliveries
  const avgHours = avgMs ? Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10 : null;

  const statusObj = {};
  STATUS_VALUES.forEach((s) => (statusObj[s] = 0));
  statusDist.forEach((s) => (statusObj[s._id] = s.count));

  res.json({
    success: true,
    data: {
      range,
      kpis: {
        totalActive,
        pendingApprovals,
        completedToday,
        completedThisMonth: completedToday,
        averageTurnaroundHours: avgHours,
        totalJobCards: totalCards,
      },
      statusDistribution: statusObj,
      serviceTypeDistribution: Object.fromEntries(serviceDist.map((s) => [s._id, s.count])),
      trend: trend.map((t) => ({ date: t._id, count: t.count })),
    },
  });
});

// GET /api/analytics/status-distribution
export const statusDistribution = asyncHandler(async (req, res) => {
  const agg = await JobCard.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const data = {};
  STATUS_VALUES.forEach((s) => (data[s] = 0));
  agg.forEach((a) => (data[a._id] = a.count));
  res.json({ success: true, data });
});

// GET /api/analytics/service-type-distribution
export const serviceTypeDistribution = asyncHandler(async (req, res) => {
  const agg = await JobCard.aggregate([{ $group: { _id: '$service.type', count: { $sum: 1 } } }]);
  res.json({ success: true, data: Object.fromEntries(agg.map((a) => [a._id, a.count])) });
});

// GET /api/analytics/advisor-performance
export const advisorPerformance = asyncHandler(async (req, res) => {
  const advisors = await Advisor.find({ isActive: true }).lean();
  const cards = await JobCard.find({})
      .select('advisor status service.actualDelivery service.createdDate createdAt')
      .lean();
  const perf = advisors.map((a) => {
    const assigned = cards.filter((c) => c.advisor?.advisorId?.toString() === a._id.toString());
    const completed = assigned.filter((c) => c.status === JOB_STATUS.DELIVERED);
    const totalMs =
      completed.length > 0
        ? completed.reduce((s, c) => {
            const start = new Date(c.service?.createdDate || c.createdAt || 0).getTime();
            const end = c.service?.actualDelivery
              ? new Date(c.service.actualDelivery).getTime()
              : 0;
            return s + Math.max(end - start, 0);
          }, 0)
        : 0;
    return {
      advisor: { id: a._id, name: a.name },
      totalAssigned: assigned.length,
      completed: completed.length,
      activeAssigned: assigned.filter((c) => c.status !== JOB_STATUS.DELIVERED).length,
      avgCompletionHours: completed.length
        ? Math.round((totalMs / completed.length / 3600000) * 10) / 10
        : 0,
    };
  });
  res.json({ success: true, data: perf });
});