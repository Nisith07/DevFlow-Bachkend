import Note from './note.model.js'
import Project from '../projects/project.model.js'
import Task from '../tasks/task.model.js'

export async function getNotes(req, res, next) {
  try {
    const owner = req.user._id
    const { project, tag, pinned, search, folder, favorite } = req.query

    const filter = { owner }

    if (project) filter.project = project
    if (tag) filter.tags = tag
    if (pinned !== undefined) filter.isPinned = pinned === 'true'
    if (favorite !== undefined) filter.isFavorite = favorite === 'true'
    if (folder !== undefined) filter.folder = folder

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
      ]
    }

    const notes = await Note.find(filter)
      .populate('project')
      .populate('task')
      .sort({ isPinned: -1, updatedAt: -1 })

    const mapped = notes.map((n) => {
      const obj = n.toObject()
      obj.id = n._id.toString()
      if (obj.project) obj.project.id = n.project._id.toString()
      if (obj.task) obj.task.id = n.task._id.toString()
      return obj
    })

    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

export async function createNote(req, res, next) {
  try {
    const owner = req.user._id
    const { title, body, project, task, isPinned, isFavorite, folder, tags } = req.body

    // Verify project ownership if project is specified
    if (project) {
      const proj = await Project.findOne({ _id: project, owner })
      if (!proj) {
        return res.status(403).json({ message: 'Forbidden: Project does not exist or you do not own it.' })
      }
    }

    // Verify task ownership if task is specified
    if (task) {
      const t = await Task.findOne({ _id: task, owner })
      if (!t) {
        return res.status(403).json({ message: 'Forbidden: Task does not exist or you do not own it.' })
      }
    }

    const note = await Note.create({
      owner,
      title: title ? title.trim() : 'Untitled Note',
      body: body || '',
      project: project || undefined,
      task: task || undefined,
      isPinned: !!isPinned,
      isFavorite: !!isFavorite,
      folder: folder ? folder.trim() : '',
      tags: Array.isArray(tags) ? tags : [],
    })

    const populated = await note.populate(['project', 'task'])
    const obj = populated.toObject()
    obj.id = populated._id.toString()
    if (obj.project) obj.project.id = populated.project._id.toString()
    if (obj.task) obj.task.id = populated.task._id.toString()

    return res.status(201).json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function getNote(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const note = await Note.findOne({ _id: id, owner })
      .populate('project')
      .populate('task')

    if (!note) {
      return res.status(404).json({ message: 'Note not found.' })
    }

    const obj = note.toObject()
    obj.id = note._id.toString()
    if (obj.project) obj.project.id = note.project._id.toString()
    if (obj.task) obj.task.id = note.task._id.toString()

    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function updateNote(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { title, body, project, task, isPinned, isFavorite, folder, tags } = req.body

    const note = await Note.findOne({ _id: id, owner })
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' })
    }

    if (project !== undefined) {
      if (project) {
        const proj = await Project.findOne({ _id: project, owner })
        if (!proj) {
          return res.status(403).json({ message: 'Forbidden: Project does not exist or you do not own it.' })
        }
        note.project = project
      } else {
        note.project = undefined
      }
    }

    if (task !== undefined) {
      if (task) {
        const t = await Task.findOne({ _id: task, owner })
        if (!t) {
          return res.status(403).json({ message: 'Forbidden: Task does not exist or you do not own it.' })
        }
        note.task = task
      } else {
        note.task = undefined
      }
    }

    if (title !== undefined) note.title = title ? title.trim() : 'Untitled Note'
    if (body !== undefined) note.body = body
    if (isPinned !== undefined) note.isPinned = !!isPinned
    if (isFavorite !== undefined) note.isFavorite = !!isFavorite
    if (folder !== undefined) note.folder = folder ? folder.trim() : ''
    if (tags !== undefined) note.tags = Array.isArray(tags) ? tags : []

    await note.save()

    const populated = await note.populate(['project', 'task'])
    const obj = populated.toObject()
    obj.id = populated._id.toString()
    if (obj.project) obj.project.id = populated.project._id.toString()
    if (obj.task) obj.task.id = populated.task._id.toString()

    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteNote(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const note = await Note.findOneAndDelete({ _id: id, owner })
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' })
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

export async function togglePinNote(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const note = await Note.findOne({ _id: id, owner })
    if (!note) {
      return res.status(404).json({ message: 'Note not found.' })
    }

    note.isPinned = !note.isPinned
    await note.save()

    const populated = await note.populate(['project', 'task'])
    const obj = populated.toObject()
    obj.id = populated._id.toString()
    if (obj.project) obj.project.id = populated.project._id.toString()
    if (obj.task) obj.task.id = populated.task._id.toString()

    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}
