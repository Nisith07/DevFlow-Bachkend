import axios from 'axios'
import Task from '../tasks/task.model.js'
import User from '../../models/User.js'
import Activity from '../activity/activity.model.js'

async function getGitHubContributions(token) {
  try {
    const response = await axios.post(
      'https://api.github.com/graphql',
      {
        query: `
          query {
            viewer {
              contributionsCollection {
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      color
                      contributionCount
                      date
                    }
                  }
                }
              }
            }
          }
        `
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'DevFlow-App'
        }
      }
    )
    return response.data?.data?.viewer?.contributionsCollection?.contributionCalendar
  } catch (err) {
    console.error('[GitHub] Failed to fetch contributions calendar:', err.message)
    return null
  }
}

/**
 * Compute consecutive-day streak from an array of activity & login dates.
 * A streak is the number of consecutive calendar days (counting back from
 * today or yesterday) on which the user was active in DevFlow.
 *
 * @param {Date[]} dates - raw timestamp values
 * @returns {number}
 */
function computeStreak(dates) {
  if (!dates || !dates.length) return 0

  const toDayString = (d) => {
    if (!d) return null
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return null
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const daySet = new Set()
  dates.forEach((d) => {
    const s = toDayString(d)
    if (s) daySet.add(s)
  })

  if (daySet.size === 0) return 0

  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  const todayStr = toDayString(cursor)

  const yesterday = new Date(cursor)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDayString(yesterday)

  // If user wasn't active today OR yesterday, streak is broken (0)
  if (!daySet.has(todayStr) && !daySet.has(yesterdayStr)) {
    return 0
  }

  // If user hasn't performed activity today yet, start counting from yesterday
  if (!daySet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (true) {
    const key = toDayString(cursor)
    if (!daySet.has(key)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export async function getDashboardSummary(req, res, next) {
  try {
    const owner = req.user._id

    // Fetch user with githubToken
    const dbUser = await User.findById(owner).select('+githubToken')
    let githubStats = { connected: false, commits: 23, contributionGrid: [3,0,5,8,2,6,1,7,4,0,8,3,9,2,6,4,0,9] }

    if (dbUser && dbUser.githubToken) {
      const calendar = await getGitHubContributions(dbUser.githubToken)
      if (calendar) {
        // Flatten the weeks to get all days
        const allDays = calendar.weeks.flatMap(w => w.contributionDays)
        
        // Sum total contributions in the last 7 days for the "This Week" commits count
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const weeklyCommits = allDays
          .filter(d => new Date(d.date) >= sevenDaysAgo)
          .reduce((sum, d) => sum + d.contributionCount, 0)

        // Get the last 18 days for the dashboard card grid
        const recentDays = allDays.slice(-18)

        githubStats = {
          connected: true,
          commits: weeklyCommits,
          totalYear: calendar.totalContributions,
          contributionGrid: recentDays.map(d => d.contributionCount)
        }
      }
    }

    // --- Date windows ---
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const yesterdayEnd = new Date(todayStart - 1) // 1ms before today midnight

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)

    // --- Parallel queries ---
    const [
      todayTasks,
      yesterdayCompleted,
      userActivities,
      taskDates,
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

      // Last 60 days of activity logs for streak calc
      Activity.find(
        { owner, createdAt: { $gte: sixtyDaysAgo } },
        { createdAt: 1 }
      ).lean(),

      // Last 60 days of task timestamps for streak calc
      Task.find(
        { owner, $or: [{ completedAt: { $gte: sixtyDaysAgo } }, { createdAt: { $gte: sixtyDaysAgo } }, { updatedAt: { $gte: sixtyDaysAgo } }] },
        { completedAt: 1, createdAt: 1, updatedAt: 1 }
      ).lean(),

      // Overall task stats
      Task.find({ owner }, { status: 1, dueDate: 1 }).lean(),
    ])

    // Update lastLoginAt if user is visiting dashboard today
    if (dbUser) {
      dbUser.lastLoginAt = now
      await dbUser.save().catch(() => {})
    }

    // --- Streak calculation across logins, activities, and tasks ---
    const allActivityDates = [
      now,
      dbUser?.lastLoginAt,
      dbUser?.createdAt,
      dbUser?.updatedAt,
      ...userActivities.map((a) => a.createdAt),
      ...taskDates.flatMap((t) => [t.completedAt, t.createdAt, t.updatedAt]),
    ].filter(Boolean)

    const streak = computeStreak(allActivityDates)

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
        githubStats,
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
