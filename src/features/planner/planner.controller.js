import PlannerEntry from './planner.model.js'
import WeeklyGoal from './weekly.model.js'
import Task from '../tasks/task.model.js'

// Parse ISO date string to a normalized UTC Date (midnight UTC)
function toMidnightUTC(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function getPlannerEntries(req, res, next) {
  try {
    const owner = req.user._id
    const { date } = req.query

    if (!date) {
      return res.status(400).json({ message: 'Date query parameter is required (YYYY-MM-DD).' })
    }

    const midnightDate = toMidnightUTC(date)
    if (!midnightDate) {
      return res.status(400).json({ message: 'Invalid date format.' })
    }

    const entries = await PlannerEntry.find({ owner, date: midnightDate })
      .populate('task')
      .sort({ startTime: 1, order: 1 })

    // Normalise _id to id
    const mapped = entries.map((entry) => {
      const obj = entry.toObject()
      obj.id = entry._id.toString()
      if (obj.task) {
        obj.task.id = entry.task._id.toString()
      }
      return obj
    })

    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

export async function createPlannerEntry(req, res, next) {
  try {
    const owner = req.user._id
    const { date, task, title, startTime, endTime, done, order, type } = req.body

    if (!date) {
      return res.status(400).json({ message: 'Date is required.' })
    }

    const midnightDate = toMidnightUTC(date)
    if (!midnightDate) {
      return res.status(400).json({ message: 'Invalid date format.' })
    }

    if (!title && !task) {
      return res.status(400).json({ message: 'Either title or task must be provided.' })
    }

    // Verify task ownership if task is linked
    if (task) {
      const linkedTask = await Task.findOne({ _id: task, owner })
      if (!linkedTask) {
        return res.status(403).json({ message: 'Forbidden: Task does not exist or you do not own it.' })
      }
    }

    const entry = await PlannerEntry.create({
      owner,
      date: midnightDate,
      task: task || undefined,
      title: title ? title.trim() : undefined,
      startTime: startTime || '',
      endTime: endTime || '',
      done: !!done,
      type: type || 'focus_task',
      order: typeof order === 'number' ? order : 0,
    })

    const populated = await entry.populate('task')
    const obj = populated.toObject()
    obj.id = populated._id.toString()
    if (obj.task) {
      obj.task.id = populated.task._id.toString()
    }

    return res.status(201).json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function updatePlannerEntry(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { date, task, title, startTime, endTime, done, order, type } = req.body

    const entry = await PlannerEntry.findOne({ _id: id, owner })
    if (!entry) {
      return res.status(404).json({ message: 'Planner entry not found.' })
    }

    if (date !== undefined) {
      const midnightDate = toMidnightUTC(date)
      if (!midnightDate) {
        return res.status(400).json({ message: 'Invalid date format.' })
      }
      entry.date = midnightDate
    }

    if (task !== undefined) {
      if (task) {
        const linkedTask = await Task.findOne({ _id: task, owner })
        if (!linkedTask) {
          return res.status(403).json({ message: 'Forbidden: Task does not exist or you do not own it.' })
        }
        entry.task = task
      } else {
        entry.task = undefined
      }
    }

    if (title !== undefined) entry.title = title ? title.trim() : undefined
    if (startTime !== undefined) entry.startTime = startTime || ''
    if (endTime !== undefined) entry.endTime = endTime || ''
    if (done !== undefined) entry.done = !!done
    if (type !== undefined) entry.type = type
    if (order !== undefined) entry.order = order

    await entry.save()

    const populated = await entry.populate('task')
    const obj = populated.toObject()
    obj.id = populated._id.toString()
    if (obj.task) {
      obj.task.id = populated.task._id.toString()
    }

    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deletePlannerEntry(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const entry = await PlannerEntry.findOneAndDelete({ _id: id, owner })
    if (!entry) {
      return res.status(404).json({ message: 'Planner entry not found.' })
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

export async function reorderPlannerEntries(req, res, next) {
  try {
    const owner = req.user._id
    const { orders } = req.body // Expects array of { id, order }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ message: 'orders must be an array.' })
    }

    const bulkOps = orders.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id, owner },
        update: { $set: { order } },
      },
    }))

    if (bulkOps.length > 0) {
      await PlannerEntry.bulkWrite(bulkOps)
    }

    return res.json({ message: 'Reordered successfully.' })
  } catch (error) {
    return next(error)
  }
}

export async function getWeeklyGoals(req, res, next) {
  try {
    const owner = req.user._id
    const { weekIdentifier } = req.query

    if (!weekIdentifier) {
      return res.status(400).json({ message: 'weekIdentifier query parameter is required (YYYY-Www).' })
    }

    const goals = await WeeklyGoal.find({ owner, weekIdentifier }).sort({ createdAt: 1 })
    const mapped = goals.map(g => {
      const obj = g.toObject()
      obj.id = g._id.toString()
      return obj
    })
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

export async function createWeeklyGoal(req, res, next) {
  try {
    const owner = req.user._id
    const { title, weekIdentifier } = req.body

    if (!title || !weekIdentifier) {
      return res.status(400).json({ message: 'Title and weekIdentifier are required.' })
    }

    const goal = await WeeklyGoal.create({
      owner,
      title: title.trim(),
      weekIdentifier: weekIdentifier.trim(),
      done: false
    })

    const obj = goal.toObject()
    obj.id = goal._id.toString()
    return res.status(201).json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function updateWeeklyGoal(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { title, done } = req.body

    const goal = await WeeklyGoal.findOne({ _id: id, owner })
    if (!goal) {
      return res.status(404).json({ message: 'Weekly goal not found.' })
    }

    if (title !== undefined) goal.title = title.trim()
    if (done !== undefined) goal.done = !!done

    await goal.save()

    const obj = goal.toObject()
    obj.id = goal._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteWeeklyGoal(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const goal = await WeeklyGoal.findOneAndDelete({ _id: id, owner })
    if (!goal) {
      return res.status(404).json({ message: 'Weekly goal not found.' })
    }
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
