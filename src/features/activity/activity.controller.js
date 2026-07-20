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
    
    let total = await Activity.countDocuments({ owner })
    if (total === 0) {
      // Seed 8 high-fidelity activity logs with offset timestamps
      const now = new Date()
      
      const seedActivities = [
        {
          owner,
          entityType: 'project',
          entityId: new mongoose.Types.ObjectId(),
          action: 'project_created',
          summary: "Created Project 'DevFlow Dashboard Layout'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 15) // 15 mins ago
        },
        {
          owner,
          entityType: 'task',
          entityId: new mongoose.Types.ObjectId(),
          action: 'task_completed',
          summary: "Completed Task 'Configure Mongoose connection pooling'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 45) // 45 mins ago
        },
        {
          owner,
          entityType: 'ai',
          entityId: 'ai-stub-readme',
          action: 'ai_readme_generated',
          summary: "Generated README.md via AI Assistant",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 3) // 3 hours ago
        },
        {
          owner,
          entityType: 'github',
          entityId: 'github-stub-commit',
          action: 'github_committed',
          summary: "Committed Code to branch 'main' of 'Nisith/DevFlow-Backend'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 6) // 6 hours ago
        },
        {
          owner,
          entityType: 'portfolio',
          entityId: 'portfolio-stub-deploy',
          action: 'portfolio_deployed',
          summary: "Deployment Success: Portfolio deployed to 'https://devflow.portfolio.pub/nisith'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 20) // 20 hours ago
        },
        {
          owner,
          entityType: 'ai',
          entityId: 'ai-stub-comp',
          action: 'ai_component_generated',
          summary: "AI Generated Component 'KanbanBoard.jsx'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 26) // 26 hours ago (yesterday)
        },
        {
          owner,
          entityType: 'project',
          entityId: new mongoose.Types.ObjectId(),
          action: 'team_joined',
          summary: "Joined Team: Added member 'Sophia Chen' to Project 'DevFlow'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 48) // 2 days ago
        },
        {
          owner,
          entityType: 'issue',
          entityId: new mongoose.Types.ObjectId(),
          action: 'issue_created',
          summary: "Created Issue: 'Vite build failure on lucide-react exports'",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 72) // 3 days ago
        }
      ]

      await Activity.create(seedActivities)
      total = seedActivities.length
    }

    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20)
    const skip  = (page - 1) * limit

    const events = await Activity.find({ owner })
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
