import Task from '../tasks/task.model.js'

/**
 * Compute consecutive-day streak from an array of completedAt dates.
 * A streak is the number of consecutive calendar days (counting back from
 * today) on which at least one task was completed.
 *
 * @param {Date[]} dates - raw completedAt values, unsorted
 * @returns {number}
 */
function computeStreak(dates) {
  if (!dates.length) return 0

  // Unique calendar days (local midnight YYYY-MM-DD strings)
  const daySet = new Set(
    dates.map((d) => new Date(d).toLocaleDateString('en-CA')) // 'en-CA' → YYYY-MM-DD
  )

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  // If nothing completed today, start counting from yesterday
  const todayKey = cursor.toLocaleDateString('en-CA')
  if (!daySet.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (true) {
    const key = cursor.toLocaleDateString('en-CA')
    if (!daySet.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export async function getDashboardSummary(req, res, next) {
  try {
    const owner = req.user._id

    // --- Date windows ---
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const yesterdayEnd = new Date(todayStart - 1) // 1ms before today midnight

    // --- Parallel queries ---
    const [
      todayTasks,
      yesterdayCompleted,
      streakDates,
      allTasks,
    ] = await Promise.all([
      // Today: tasks pinned with isToday flag OR due today
      Task.find({
        owner,
        $or: [
          { isToday: true },
          { dueDate: { $gte: todayStart, $lte: todayEnd } },
        ],
      }).sort({ order: 1, createdAt: 1 }).lean(),

      // Yesterday: tasks completed yesterday
      Task.find({
        owner,
        status: 'done',
        completedAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      }).sort({ completedAt: -1 }).lean(),

      // Last 60 days of completedAt dates for streak calc
      Task.find(
        { owner, status: 'done', completedAt: { $gte: new Date(Date.now() - 60 * 86400000) } },
        { completedAt: 1 }
      ).lean(),

      // Overall task stats
      Task.find({ owner }, { status: 1, dueDate: 1 }).lean(),
    ])

    // --- Streak ---
    const streak = computeStreak(streakDates.map((t) => t.completedAt))

    // --- Stats ---
    const totalTasks   = allTasks.length
    const doneTasks    = allTasks.filter((t) => t.status === 'done').length
    const overdueTasks = allTasks.filter(
      (t) => t.dueDate && t.status !== 'done' && t.status !== 'cancelled' && new Date(t.dueDate) < todayStart
    ).length

    // Normalise _id → id for frontend consistency
    const normalise = (t) => ({ ...t, id: t._id.toString() })

    return res.json({
      data: {
        todayTasks:         todayTasks.map(normalise),
        yesterdayCompleted: yesterdayCompleted.map(normalise),
        streak,
        stats: {
          total:   totalTasks,
          done:    doneTasks,
          overdue: overdueTasks,
          active:  totalTasks - doneTasks,
        },
      },
    })
  } catch (error) {
    return next(error)
  }
}
