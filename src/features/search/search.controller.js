import Task from '../tasks/task.model.js'
import Project from '../projects/project.model.js'

export async function globalSearch(req, res, next) {
  try {
    const owner = req.user._id
    const query = req.query.q

    if (!query || query.trim().length === 0) {
      return res.json({ data: { tasks: [], projects: [] } })
    }

    const regex = new RegExp(query.trim(), 'i')

    const [tasks, projects] = await Promise.all([
      Task.find({ owner, $or: [{ title: regex }, { description: regex }] })
        .limit(10)
        .select('title status priority isToday dueDate')
        .lean(),
      Project.find({ owner, $or: [{ name: regex }, { description: regex }] })
        .limit(5)
        .select('name icon status')
        .lean(),
    ])

    return res.json({
      data: {
        tasks,
        projects,
      },
    })
  } catch (error) {
    return next(error)
  }
}
