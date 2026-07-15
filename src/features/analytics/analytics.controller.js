import mongoose from 'mongoose'

/**
 * Analytics controller — all read-only MongoDB aggregation pipelines.
 * No model file needed; queries run directly on existing collections.
 */
import Task from '../tasks/task.model.js'
import Project from '../projects/project.model.js'

export async function getAnalyticsSummary(req, res, next) {
  try {
    const owner = req.user._id

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      taskStats,
      priorityBreakdown,
      projectStats,
      completionHeatmap,
    ] = await Promise.all([
      // ── Overall task stats ──────────────────────────────────────────────────
      Task.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(owner) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),

      // ── Tasks by priority ────────────────────────────────────────────────────
      Task.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(owner),
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
          },
        },
      ]),

      // ── Project task counts ──────────────────────────────────────────────────
      Task.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(owner),
            project: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            done: {
              $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: 'projects',
            localField: '_id',
            foreignField: '_id',
            as: 'projectInfo',
          },
        },
        { $unwind: '$projectInfo' },
        {
          $project: {
            _id: 0,
            projectId: { $toString: '$_id' },
            name: '$projectInfo.name',
            icon: '$projectInfo.icon',
            color: '$projectInfo.color',
            total: 1,
            done: 1,
            completion: {
              $round: [
                { $multiply: [{ $divide: ['$done', '$total'] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),

      // ── Completion heatmap: tasks completed per day, last 30 days ────────────
      Task.aggregate([
        {
          $match: {
            owner: new mongoose.Types.ObjectId(owner),
            status: 'done',
            completedAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
    ])

    // Normalise task stats into a simple object
    const statusMap = { todo: 0, in_progress: 0, in_review: 0, done: 0, cancelled: 0 }
    for (const s of taskStats) {
      statusMap[s._id] = s.count
    }

    const totalActive   = statusMap.todo + statusMap.in_progress + statusMap.in_review
    const totalDone     = statusMap.done
    const totalAll      = totalActive + totalDone + statusMap.cancelled
    const completionRate = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0

    // Normalise priority breakdown
    const priorityOrder = ['urgent', 'high', 'medium', 'low', 'none']
    const priorityMap = Object.fromEntries(
      priorityBreakdown.map((p) => [p._id, p.count])
    )
    const priorities = priorityOrder.map((p) => ({
      priority: p,
      count: priorityMap[p] ?? 0,
    }))

    return res.json({
      data: {
        overview: {
          total: totalAll,
          active: totalActive,
          done: totalDone,
          cancelled: statusMap.cancelled,
          completionRate,
        },
        statusBreakdown: statusMap,
        priorities,
        projectStats,
        heatmap: completionHeatmap,
      },
    })
  } catch (error) {
    return next(error)
  }
}
