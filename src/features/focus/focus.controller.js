import FocusSession from './focus.model.js'
import { recordActivity } from '../activity/activity.controller.js'

// ── Start a new focus session ─────────────────────────────────────────────────
export async function startSession(req, res, next) {
  try {
    const owner = req.user._id
    const { mode, targetMinutes, project, task, label } = req.body

    // Check for already active session
    const existing = await FocusSession.findOne({ owner, status: 'active' })
    if (existing) {
      return res.status(409).json({
        message: 'You already have an active focus session.',
        data: { ...existing.toObject(), id: existing._id.toString() }
      })
    }

    const session = await FocusSession.create({
      owner,
      mode: mode || 'pomodoro',
      targetMinutes: targetMinutes || (mode === 'deep_work' ? 90 : 25),
      project: project || null,
      task: task || null,
      label: label?.trim() || '',
      startedAt: new Date(),
      status: 'active',
      interruptions: [],
    })

    recordActivity({
      owner,
      entityType: 'focus',
      entityId: session._id,
      action: 'focus_started',
      summary: `Started ${session.mode === 'pomodoro' ? 'Pomodoro' : 'Deep Work'} session (${session.targetMinutes} min)${label ? `: "${label}"` : ''}`,
      meta: { mode: session.mode, targetMinutes: session.targetMinutes, label },
    })

    const obj = session.toObject()
    obj.id = session._id.toString()
    return res.status(201).json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

// ── End / complete a session ──────────────────────────────────────────────────
export async function endSession(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { status } = req.body // 'completed' or 'abandoned'

    const session = await FocusSession.findOne({ _id: id, owner })
    if (!session) {
      return res.status(404).json({ message: 'Session not found.' })
    }
    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Session is already ended.' })
    }

    const endedAt = new Date()
    const actualMinutes = Math.round((endedAt - session.startedAt) / 60000)

    session.endedAt = endedAt
    session.actualMinutes = actualMinutes
    session.status = status === 'abandoned' ? 'abandoned' : 'completed'
    await session.save()

    const action = session.status === 'completed' ? 'focus_completed' : 'focus_abandoned'
    recordActivity({
      owner,
      entityType: 'focus',
      entityId: session._id,
      action,
      summary: `${session.status === 'completed' ? 'Completed' : 'Abandoned'} focus session — ${actualMinutes} min${session.interruptions.length > 0 ? `, ${session.interruptions.length} interruption(s)` : ''}`,
      meta: { mode: session.mode, actualMinutes, targetMinutes: session.targetMinutes, interruptions: session.interruptions.length },
    })

    const obj = session.toObject()
    obj.id = session._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

// ── Log an interruption ───────────────────────────────────────────────────────
export async function logInterruption(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { note } = req.body

    const session = await FocusSession.findOne({ _id: id, owner })
    if (!session) return res.status(404).json({ message: 'Session not found.' })
    if (session.status !== 'active') return res.status(400).json({ message: 'Cannot log interruption on ended session.' })

    session.interruptions.push({ at: new Date(), note: note?.trim() || '' })
    await session.save()

    const obj = session.toObject()
    obj.id = session._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

// ── Get active session (if any) ───────────────────────────────────────────────
export async function getActiveSession(req, res, next) {
  try {
    const owner = req.user._id
    const session = await FocusSession.findOne({ owner, status: 'active' })
      .populate('project', 'name color icon')
      .populate('task', 'title')
      .lean()

    if (!session) return res.json({ data: null })

    session.id = session._id.toString()
    return res.json({ data: session })
  } catch (error) {
    return next(error)
  }
}

// ── List sessions ─────────────────────────────────────────────────────────────
export async function getSessions(req, res, next) {
  try {
    const owner = req.user._id
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20)

    const sessions = await FocusSession.find({ owner, status: { $ne: 'active' } })
      .sort({ startedAt: -1 })
      .limit(limit)
      .populate('project', 'name color icon')
      .populate('task', 'title')
      .lean()

    return res.json({
      data: sessions.map(s => ({ ...s, id: s._id.toString() }))
    })
  } catch (error) {
    return next(error)
  }
}

// ── Aggregate stats for analytics ────────────────────────────────────────────
export async function getFocusStats(req, res, next) {
  try {
    const owner = req.user._id
    const now = new Date()

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const [weekSessions, todaySessions, allTimeSessions] = await Promise.all([
      // This week's completed sessions
      FocusSession.find({
        owner,
        status: 'completed',
        startedAt: { $gte: sevenDaysAgo },
      }).lean(),

      // Today's sessions
      FocusSession.find({
        owner,
        status: 'completed',
        startedAt: { $gte: todayStart },
      }).lean(),

      // All time for longest session
      FocusSession.find({ owner, status: 'completed' })
        .sort({ actualMinutes: -1 })
        .limit(1)
        .lean(),
    ])

    const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0)
    const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0)
    const weekInterruptions = weekSessions.reduce((sum, s) => sum + (s.interruptions?.length || 0), 0)
    const longestSession = allTimeSessions[0]?.actualMinutes || 0

    // Daily breakdown for this week
    const dailyFocus = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)

      const daySessions = weekSessions.filter(s => {
        const start = new Date(s.startedAt)
        return start >= dayStart && start <= dayEnd
      })

      dailyFocus.push({
        date: d.toLocaleDateString('en-CA'),
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: daySessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0),
        sessions: daySessions.length,
      })
    }

    return res.json({
      data: {
        todayMinutes,
        weekMinutes,
        weekSessions: weekSessions.length,
        weekInterruptions,
        longestSession,
        dailyFocus,
        // Productivity score component: focus minutes weighted
        focusScore: Math.min(100, Math.round(weekMinutes / 3)), // 300 min/week = 100 score
      }
    })
  } catch (error) {
    return next(error)
  }
}

// ── Re-focus nudge ────────────────────────────────────────────────────────────
// Returns a suggestion if user hasn't started a session in a while
export async function getFocusNudge(req, res, next) {
  try {
    const owner = req.user._id

    // Find the most recent session
    const lastSession = await FocusSession.findOne({ owner })
      .sort({ startedAt: -1 })
      .lean()

    const now = new Date()
    let nudge = null

    if (!lastSession) {
      nudge = {
        message: "Ready to get into deep work? Start your first focus session to begin tracking your productive time.",
        type: 'welcome',
      }
    } else if (lastSession.status === 'active') {
      nudge = null // Already in a session
    } else {
      const minutesSinceLast = Math.round((now - new Date(lastSession.startedAt)) / 60000)
      if (minutesSinceLast > 90) {
        nudge = {
          message: `It's been ${Math.round(minutesSinceLast / 60)} hour(s) since your last focus session. Time for another round? 🎯`,
          type: 'remind',
          minutesSinceLast,
        }
      }
    }

    return res.json({ data: nudge })
  } catch (error) {
    return next(error)
  }
}
