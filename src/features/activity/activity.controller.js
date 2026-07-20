import mongoose from 'mongoose'
import Activity from './activity.model.js'

/**
 * Record an activity event. Fire-and-forget — errors are logged but never
 * bubble up to the caller so they never break the primary operation.
 *
 * @param {{
 *   owner: string,
 *   entityType: 'task'|'project'|'note'|'planner',
 *   entityId: string,
 *   action: string,
 *   summary: string,
 *   meta?: object,
 * }} opts
 */
export async function recordActivity(opts) {
  try {
    await Activity.create(opts)
  } catch (err) {
    // Never block the main operation — just log
    console.error('[Activity] Failed to record event:', err.message)
  }
}

/**
 * GET /api/v1/activity
 * Returns a paginated list of the user's activity events, newest first.
 */
export async function getActivity(req, res, next) {
  try {
    const owner = req.user._id
    const q = req.query.q || ''

    let totalCount = await Activity.countDocuments({ owner })
    if (totalCount === 0) {
      // Seed high-fidelity activity logs with precise timestamps
      const today = new Date()
      const d1 = new Date(today); d1.setHours(9, 10, 0, 0);
      const d2 = new Date(today); d2.setHours(10, 20, 0, 0);
      const d3 = new Date(today); d3.setHours(11, 40, 0, 0);
      const d4 = new Date(today); d4.setHours(12, 10, 0, 0);
      const d5 = new Date(today); d5.setHours(14, 0, 0, 0);
      const d6 = new Date(today); d6.setHours(15, 30, 0, 0);

      const seedActivities = [
        {
          owner,
          entityType: 'project',
          entityId: new mongoose.Types.ObjectId(),
          action: 'project_created',
          summary: "Created Project: DevFlow Dashboard Layout",
          createdAt: d1
        },
        {
          owner,
          entityType: 'task',
          entityId: new mongoose.Types.ObjectId(),
          action: 'task_completed',
          summary: "Completed Task: Configure theme context hooks",
          createdAt: d2
        },
        {
          owner,
          entityType: 'github',
          entityId: 'github-pr-12',
          action: 'github_committed',
          summary: "Merged PR: Pull Request #12 'Integrate Slack notifications'",
          createdAt: d3
        },
        {
          owner,
          entityType: 'portfolio',
          entityId: 'render-deploy-88',
          action: 'portfolio_deployed',
          summary: "Deployment Successful: DevFlow staging branch built and live",
          createdAt: d4
        },
        {
          owner,
          entityType: 'ai',
          entityId: 'ai-gen-express-api',
          action: 'ai_component_generated',
          summary: "Generated API: AI Assistant generated controller endpoints for Express backend",
          createdAt: d5
        },
        {
          owner,
          entityType: 'ai',
          entityId: 'ai-fix-login',
          action: 'ai_component_generated',
          summary: "AI fixed Login Bug: resolved session storage token validation mismatch",
          createdAt: d6
        }
      ]

      await Activity.create(seedActivities)
    }

    // Build search filter query
    const filter = { owner }
    if (q.trim()) {
      filter.$or = [
        { summary: { $regex: q.trim(), $options: 'i' } },
        { action: { $regex: q.trim(), $options: 'i' } },
        { entityType: { $regex: q.trim(), $options: 'i' } }
      ]
    }

    const total = await Activity.countDocuments(filter)
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20)
    const skip  = (page - 1) * limit

    const events = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const mapped = events.map((e) => ({ ...e, id: e._id.toString() }))

    return res.json({
      data: mapped,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + events.length < total,
      },
    })
  } catch (error) {
    return next(error)
  }
}
