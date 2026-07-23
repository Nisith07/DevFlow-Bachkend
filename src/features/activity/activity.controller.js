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
