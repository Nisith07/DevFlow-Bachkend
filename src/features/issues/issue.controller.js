import Issue from './issue.model.js'
import Project from '../projects/project.model.js'
import { recordActivity } from '../activity/activity.controller.js'

// Helper to verify project ownership
async function verifyProject(projectId, ownerId) {
  if (!projectId) return true
  const project = await Project.findOne({ _id: projectId, owner: ownerId })
  return !!project
}

export async function getIssues(req, res, next) {
  try {
    const owner = req.user._id
    const { status, type, project, search } = req.query

    const filter = { owner }

    if (status) filter.status = status
    if (type) filter.type = type
    if (project) filter.project = project

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim()
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }

    const issues = await Issue.find(filter)
      .populate('assignee', 'name email avatarUrl')
      .populate('project', 'name color icon title')
      .sort({ createdAt: -1 })

    const mappedIssues = issues.map(iss => {
      const obj = iss.toObject()
      obj.id = iss._id.toString()
      return obj
    })

    return res.json({ data: mappedIssues })
  } catch (error) {
    return next(error)
  }
}

export async function getIssue(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const issue = await Issue.findOne({ _id: id, owner })
      .populate('assignee', 'name email avatarUrl')
      .populate('project', 'name color icon title')
      .populate('comments.author', 'name email avatarUrl')

    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' })
    }

    const responseObj = issue.toObject()
    responseObj.id = issue._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function createIssue(req, res, next) {
  try {
    const owner = req.user._id
    const {
      title,
      description,
      status,
      type,
      priority,
      project,
      assignee
    } = req.body

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Issue title is required.' })
    }

    if (project) {
      const valid = await verifyProject(project, owner)
      if (!valid) {
        return res.status(403).json({ message: 'Forbidden: Project does not exist or you do not own it.' })
      }
    }

    const issue = await Issue.create({
      owner,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      status: status || 'open',
      type: type || 'bug',
      priority: priority || 'medium',
      project: project || undefined,
      assignee: assignee || undefined,
      comments: []
    })

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatarUrl')
      .populate('project', 'name color icon title')

    const responseObj = populated.toObject()
    responseObj.id = populated._id.toString()

    recordActivity({
      owner,
      entityType: 'issue',
      entityId: issue._id,
      action: 'issue_created',
      summary: `Reported issue: "${issue.title}" (${issue.type})`,
      meta: { title: issue.title, type: issue.type }
    })

    return res.status(201).json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function updateIssue(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const {
      title,
      description,
      status,
      type,
      priority,
      project,
      assignee
    } = req.body

    const issue = await Issue.findOne({ _id: id, owner })
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' })
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Issue title cannot be empty.' })
      }
      issue.title = title.trim()
    }

    if (project !== undefined) {
      if (project) {
        const valid = await verifyProject(project, owner)
        if (!valid) {
          return res.status(403).json({ message: 'Forbidden: Project does not exist or you do not own it.' })
        }
        issue.project = project
      } else {
        issue.project = undefined
      }
    }

    if (description !== undefined) issue.description = description
    if (status !== undefined) issue.status = status
    if (type !== undefined) issue.type = type
    if (priority !== undefined) issue.priority = priority
    if (assignee !== undefined) issue.assignee = assignee || undefined

    await issue.save()

    const populated = await Issue.findById(issue._id)
      .populate('assignee', 'name email avatarUrl')
      .populate('project', 'name color icon title')
      .populate('comments.author', 'name email avatarUrl')

    const responseObj = populated.toObject()
    responseObj.id = populated._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteIssue(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const issue = await Issue.findOneAndDelete({ _id: id, owner })
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' })
    }

    recordActivity({
      owner,
      entityType: 'issue',
      entityId: issue._id,
      action: 'issue_deleted',
      summary: `Deleted issue "${issue.title}"`,
      meta: { title: issue.title }
    })

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

export async function addIssueComment(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { content } = req.body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required.' })
    }

    const issue = await Issue.findOne({ _id: id, owner })
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' })
    }

    issue.comments.push({ author: owner, content: content.trim() })
    await issue.save()

    const populated = await Issue.findById(id)
      .populate('assignee', 'name email avatarUrl')
      .populate('project', 'name color icon title')
      .populate('comments.author', 'name email avatarUrl')

    const responseObj = populated.toObject()
    responseObj.id = populated._id.toString()

    return res.status(201).json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteIssueComment(req, res, next) {
  try {
    const owner = req.user._id
    const { id, commentId } = req.params

    const issue = await Issue.findOne({ _id: id, owner })
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' })
    }

    issue.comments.pull(commentId)
    await issue.save()

    const populated = await Issue.findById(id)
      .populate('assignee', 'name email avatarUrl')
      .populate('project', 'name color icon title')
      .populate('comments.author', 'name email avatarUrl')

    const responseObj = populated.toObject()
    responseObj.id = populated._id.toString()

    return res.json({ data: responseObj })
  } catch (error) {
    return next(error)
  }
}
