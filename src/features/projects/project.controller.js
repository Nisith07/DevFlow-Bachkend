import Project from './project.model.js'
import { recordActivity } from '../activity/activity.controller.js'

export async function getProjects(req, res, next) {
  try {
    const owner = req.user._id
    // Fetch user's projects
    const projects = await Project.find({ owner }).sort({ updatedAt: -1 })
    
    // For now, taskCount is mocked since tasks feature is built in Phase 3.
    // We map it to include structural placeholder counts so frontend works seamlessly.
    const projectsWithCounts = projects.map(p => {
      const obj = p.toObject()
      return {
        ...obj,
        id: p._id.toString(),
        taskCount: 0,
        completedTaskCount: 0,
      }
    })

    return res.json({ data: projectsWithCounts })
  } catch (error) {
    return next(error)
  }
}

export async function createProject(req, res, next) {
  try {
    const owner = req.user._id
    const { name, description, color, icon, status, priority, dueDate, tags } = req.body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required.' })
    }
    if (name.length > 120) {
      return res.status(400).json({ message: 'Project name must be 120 characters or fewer.' })
    }

    const project = await Project.create({
      owner,
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      color: typeof color === 'string' ? color : '#4FB8A8',
      icon: typeof icon === 'string' ? icon : '📁',
      status: status || 'active',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags: Array.isArray(tags) ? tags : [],
    })

    const responseObj = project.toObject()
    responseObj.id = project._id.toString()
    responseObj.taskCount = 0
    responseObj.completedTaskCount = 0

    recordActivity({
      owner: owner,
      entityType: 'project',
      entityId: project._id,
      action: 'project_created',
      summary: `Created project "${project.name}"`,
      meta: { name: project.name, icon: project.icon },
    })

    return res.status(201).json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function getProject(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const project = await Project.findOne({ _id: id, owner })
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' })
    }

    const responseObj = project.toObject()
    responseObj.id = project._id.toString()
    responseObj.taskCount = 0
    responseObj.completedTaskCount = 0

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function updateProject(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { name, description, color, icon, status, priority, dueDate, tags } = req.body

    const project = await Project.findOne({ _id: id, owner })
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' })
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Project name cannot be empty.' })
      }
      if (name.length > 120) {
        return res.status(400).json({ message: 'Project name must be 120 characters or fewer.' })
      }
      project.name = name.trim()
    }

    if (description !== undefined) {
      project.description = typeof description === 'string' ? description.trim() : ''
    }
    if (color !== undefined) project.color = color
    if (icon !== undefined) project.icon = icon
    if (status !== undefined) project.status = status
    if (priority !== undefined) project.priority = priority
    if (dueDate !== undefined) project.dueDate = dueDate ? new Date(dueDate) : null
    if (tags !== undefined) project.tags = Array.isArray(tags) ? tags : []

    await project.save()

    const responseObj = project.toObject()
    responseObj.id = project._id.toString()
    responseObj.taskCount = 0
    responseObj.completedTaskCount = 0

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteProject(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const project = await Project.findOneAndDelete({ _id: id, owner })
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' })
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
