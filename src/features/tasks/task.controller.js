import Task from './task.model.js'
import Project from '../projects/project.model.js'
import { recordActivity } from '../activity/activity.controller.js'

// Helper to verify project ownership
async function verifyProject(projectId, ownerId) {
  if (!projectId) return true
  const project = await Project.findOne({ _id: projectId, owner: ownerId })
  return !!project
}

export async function getTasks(req, res, next) {
  try {
    const owner = req.user._id
    const { status, priority, project, isToday, date } = req.query

    const filter = { owner }

    if (status) filter.status = status
    if (priority) filter.priority = priority
    
    if (project) {
      filter.project = project
    }
    
    if (isToday !== undefined) {
      filter.isToday = isToday === 'true'
    }

    if (date) {
      // Normalize plannedDate
      const startOfDay = new Date(date)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setUTCHours(23, 59, 59, 999)
      filter.plannedDate = { $gte: startOfDay, $lte: endOfDay }
    }

    const tasks = await Task.find(filter).sort({ order: 1, createdAt: -1 })
    
    // Normalise _id to id
    const mappedTasks = tasks.map(t => {
      const obj = t.toObject()
      obj.id = t._id.toString()
      return obj
    })

    return res.json({ data: mappedTasks })
  } catch (error) {
    return next(error)
  }
}

export async function createTask(req, res, next) {
  try {
    const owner = req.user._id
    const {
      project,
      title,
      description,
      status,
      priority,
      dueDate,
      dueTime,
      labels,
      isToday,
      plannedDate,
    } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Task title is required.' })
    }

    // Verify project ownership if project is specified
    if (project) {
      const valid = await verifyProject(project, owner)
      if (!valid) {
        return res.status(403).json({ message: 'Forbidden: Project does not exist or you do not own it.' })
      }
    }

    const task = await Task.create({
      owner,
      project: project || undefined,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      status: status || 'todo',
      priority: priority || 'none',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      dueTime: dueTime || '',
      labels: Array.isArray(labels) ? labels : [],
      isToday: !!isToday,
      plannedDate: plannedDate ? new Date(plannedDate) : undefined,
      completedAt: status === 'done' ? new Date() : undefined,
    })

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    // Record activity (fire-and-forget)
    recordActivity({
      owner: owner,
      entityType: 'task',
      entityId: task._id,
      action: 'task_created',
      summary: `Created task "${task.title}"`,
      meta: { title: task.title, priority: task.priority },
    })

    return res.status(201).json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function getTask(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const task = await Task.findOne({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function updateTask(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const {
      project,
      title,
      description,
      status,
      priority,
      dueDate,
      dueTime,
      labels,
      isToday,
      plannedDate,
    } = req.body

    const task = await Task.findOne({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Task title cannot be empty.' })
      }
      task.title = title.trim()
    }

    if (project !== undefined) {
      if (project) {
        const valid = await verifyProject(project, owner)
        if (!valid) {
          return res.status(403).json({ message: 'Forbidden: Project does not exist or you do not own it.' })
        }
        task.project = project
      } else {
        task.project = undefined
      }
    }

    if (description !== undefined) task.description = description
    if (priority !== undefined) task.priority = priority
    if (dueTime !== undefined) task.dueTime = dueTime
    if (labels !== undefined) task.labels = labels
    if (isToday !== undefined) task.isToday = isToday
    if (plannedDate !== undefined) task.plannedDate = plannedDate

    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : undefined
    }

    if (status !== undefined) {
      if (status === 'done' && task.status !== 'done') {
        task.completedAt = new Date()
      } else if (status !== 'done' && task.status === 'done') {
        task.completedAt = undefined
      }
      task.status = status
    }

    await task.save()

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteTask(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const task = await Task.findOneAndDelete({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    recordActivity({
      owner: owner,
      entityType: 'task',
      entityId: task._id,
      action: 'task_deleted',
      summary: `Deleted task "${task.title}"`,
      meta: { title: task.title },
    })

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

// Subtasks endpoints
export async function addSubtask(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { title } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Subtask title is required.' })
    }

    const task = await Task.findOne({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    const subtask = { title: title.trim(), done: false }
    task.subtasks.push(subtask)
    await task.save()

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    return res.status(201).json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function updateSubtask(req, res, next) {
  try {
    const owner = req.user._id
    const { id, subId } = req.params
    const { title, done } = req.body

    const task = await Task.findOne({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    const subtask = task.subtasks.id(subId)
    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found.' })
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Subtask title cannot be empty.' })
      }
      subtask.title = title.trim()
    }
    if (done !== undefined) {
      subtask.done = !!done
    }

    await task.save()

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteSubtask(req, res, next) {
  try {
    const owner = req.user._id
    const { id, subId } = req.params

    const task = await Task.findOne({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    const subtask = task.subtasks.id(subId)
    if (!subtask) {
      return res.status(404).json({ message: 'Subtask not found.' })
    }

    // Modern mongoose subdocument deletion: use subtask.deleteOne() or task.subtasks.pull(subId)
    task.subtasks.pull(subId)
    await task.save()

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function completeTask(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const task = await Task.findOne({ _id: id, owner })
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' })
    }

    task.status = 'done'
    task.completedAt = new Date()
    await task.save()

    const responseObj = task.toObject()
    responseObj.id = task._id.toString()

    recordActivity({
      owner: owner,
      entityType: 'task',
      entityId: task._id,
      action: 'task_completed',
      summary: `Completed task "${task.title}"`,
      meta: { title: task.title },
    })

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}
