import Project from './project.model.js'
import { recordActivity } from '../activity/activity.controller.js'

export async function getProjects(req, res, next) {
  try {
    const owner = req.user._id
    const { status, search, favorite } = req.query
    
    let filter = { owner }
    
    if (status && status !== 'all') {
      filter.status = status
    }
    
    if (favorite === 'true') {
      filter.isFavorite = true
    }
    
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' }
      filter.$or = [
        { name: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { techStack: searchRegex },
        { technologies: searchRegex }
      ]
    }

    const projects = await Project.find(filter)
      .populate('teamMembers', 'name email avatarUrl')
      .sort({ updatedAt: -1 })
    
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
    const {
      name, title, description, color, icon, status, priority, dueDate, deadline, startDate, tags,
      techStack, technologies, teamMembers, timeline, roadmap, documentation, deployments, aiSummary, metrics,
      githubRepo, progress, isFavorite, isArchived, sprints
    } = req.body

    const nameOrTitle = name || title;
    if (!nameOrTitle || typeof nameOrTitle !== 'string' || !nameOrTitle.trim()) {
      return res.status(400).json({ message: 'Project name or title is required.' })
    }
    if (nameOrTitle.length > 120) {
      return res.status(400).json({ message: 'Project name must be 120 characters or fewer.' })
    }

    const project = await Project.create({
      owner,
      name: nameOrTitle.trim(),
      title: nameOrTitle.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      color: typeof color === 'string' ? color : '#4FB8A8',
      icon: typeof icon === 'string' ? icon : '📁',
      status: status || 'active',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : (deadline ? new Date(deadline) : undefined),
      deadline: deadline ? new Date(deadline) : (dueDate ? new Date(dueDate) : undefined),
      startDate: startDate ? new Date(startDate) : undefined,
      tags: Array.isArray(tags) ? tags : [],
      techStack: Array.isArray(techStack) ? techStack : (Array.isArray(technologies) ? technologies : []),
      technologies: Array.isArray(technologies) ? technologies : (Array.isArray(techStack) ? techStack : []),
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
      timeline: Array.isArray(timeline) ? timeline : [],
      roadmap: Array.isArray(roadmap) ? roadmap : [],
      documentation: Array.isArray(documentation) ? documentation : [],
      deployments: Array.isArray(deployments) ? deployments : [],
      aiSummary: typeof aiSummary === 'string' ? aiSummary : '',
      metrics: metrics || { progress: progress || 0, openIssues: 0, features: 0, lastUpdated: new Date() },
      githubRepo: typeof githubRepo === 'string' ? githubRepo.trim() : '',
      progress: progress !== undefined ? Number(progress) : 0,
      isFavorite: !!isFavorite,
      isArchived: !!isArchived || status === 'archived',
      sprints: Array.isArray(sprints) ? sprints : [],
    })

    const populatedProject = await Project.findById(project._id).populate('teamMembers', 'name email avatarUrl')
    const responseObj = populatedProject.toObject()
    responseObj.id = populatedProject._id.toString()
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
      .populate('teamMembers', 'name email avatarUrl')
    
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
    const {
      name, title, description, color, icon, status, priority, dueDate, deadline, startDate, tags,
      techStack, technologies, teamMembers, timeline, roadmap, documentation, deployments, aiSummary, metrics,
      githubRepo, progress, isFavorite, isArchived, sprints
    } = req.body

    const project = await Project.findOne({ _id: id, owner })
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' })
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Project title cannot be empty.' })
      }
      if (title.length > 120) {
        return res.status(400).json({ message: 'Project title must be 120 characters or fewer.' })
      }
      project.title = title.trim()
      project.name = title.trim()
    } else if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Project name cannot be empty.' })
      }
      if (name.length > 120) {
        return res.status(400).json({ message: 'Project name must be 120 characters or fewer.' })
      }
      project.name = name.trim()
      project.title = name.trim()
    }

    if (description !== undefined) {
      project.description = typeof description === 'string' ? description.trim() : ''
    }
    if (color !== undefined) project.color = color
    if (icon !== undefined) project.icon = icon
    if (status !== undefined) project.status = status
    if (priority !== undefined) project.priority = priority
    if (dueDate !== undefined) project.dueDate = dueDate ? new Date(dueDate) : null
    if (deadline !== undefined) project.deadline = deadline ? new Date(deadline) : null
    if (startDate !== undefined) project.startDate = startDate ? new Date(startDate) : null
    if (tags !== undefined) project.tags = Array.isArray(tags) ? tags : []
    if (techStack !== undefined) project.techStack = Array.isArray(techStack) ? techStack : []
    if (technologies !== undefined) project.technologies = Array.isArray(technologies) ? technologies : []
    if (teamMembers !== undefined) project.teamMembers = Array.isArray(teamMembers) ? teamMembers : []
    if (timeline !== undefined) project.timeline = Array.isArray(timeline) ? timeline : []
    if (roadmap !== undefined) project.roadmap = Array.isArray(roadmap) ? roadmap : []
    if (documentation !== undefined) project.documentation = Array.isArray(documentation) ? documentation : []
    if (deployments !== undefined) project.deployments = Array.isArray(deployments) ? deployments : []
    if (aiSummary !== undefined) project.aiSummary = typeof aiSummary === 'string' ? aiSummary : ''
    
    if (githubRepo !== undefined) project.githubRepo = typeof githubRepo === 'string' ? githubRepo.trim() : ''
    if (progress !== undefined) project.progress = Number(progress)
    if (isFavorite !== undefined) project.isFavorite = !!isFavorite
    if (isArchived !== undefined) project.isArchived = !!isArchived
    if (sprints !== undefined) project.sprints = Array.isArray(sprints) ? sprints : []

    if (metrics !== undefined) {
      project.metrics = { ...project.metrics, ...metrics }
    }
    project.metrics.lastUpdated = new Date()

    await project.save()

    const populatedProject = await Project.findById(project._id).populate('teamMembers', 'name email avatarUrl')
    const responseObj = populatedProject.toObject()
    responseObj.id = populatedProject._id.toString()
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
