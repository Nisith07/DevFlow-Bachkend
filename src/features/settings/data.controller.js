import Task from '../tasks/task.model.js'
import Project from '../projects/project.model.js'
import Note from '../notes/note.model.js'
import Snippet from '../snippets/snippet.model.js'
import Issue from '../issues/issue.model.js'
import PlannerEntry from '../planner/planner.model.js'
import { recordActivity } from '../activity/activity.controller.js'

/**
 * Export full workspace data as JSON for offline backup
 * GET /api/v1/data/export
 */
export async function exportWorkspaceData(req, res, next) {
  try {
    const owner = req.user._id

    const [tasks, projects, notes, snippets, issues, planner] = await Promise.all([
      Task.find({ owner }).lean(),
      Project.find({ owner }).lean(),
      Note.find({ owner }).lean(),
      Snippet.find({ owner }).lean(),
      Issue.find({ owner }).lean(),
      PlannerEntry.find({ owner }).lean(),
    ])

    const backupData = {
      app: 'DevFlow',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: owner.toString(),
        name: req.user.name,
        email: req.user.email,
      },
      data: {
        projects,
        tasks,
        notes,
        snippets,
        issues,
        planner,
      }
    }

    await recordActivity(owner, 'project', 'workspace_exported', 'project_updated', 'Exported full workspace backup JSON', {}).catch(() => {})

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="devflow-backup-${new Date().toISOString().split('T')[0]}.json"`)
    return res.json(backupData)
  } catch (error) {
    return next(error)
  }
}

/**
 * Import workspace data from JSON backup
 * POST /api/v1/data/import
 */
export async function importWorkspaceData(req, res, next) {
  try {
    const owner = req.user._id
    const { backup } = req.body

    if (!backup || typeof backup !== 'object' || !backup.data) {
      return res.status(400).json({ message: 'Invalid backup file payload. Must contain valid DevFlow JSON data.' })
    }

    const { projects = [], tasks = [], notes = [], snippets = [], issues = [] } = backup.data

    let importedCount = 0

    // Import Projects
    if (Array.isArray(projects) && projects.length > 0) {
      const projectDocs = projects.map(p => ({
        owner,
        name: p.name || 'Imported Project',
        description: p.description || '',
        status: p.status || 'active',
        tags: Array.isArray(p.tags) ? p.tags : [],
      }))
      await Project.insertMany(projectDocs, { ordered: false }).catch(() => {})
      importedCount += projectDocs.length
    }

    // Import Tasks
    if (Array.isArray(tasks) && tasks.length > 0) {
      const taskDocs = tasks.map(t => ({
        owner,
        title: t.title || 'Imported Task',
        description: t.description || '',
        status: t.status || 'todo',
        priority: t.priority || 'medium',
        isToday: Boolean(t.isToday),
      }))
      await Task.insertMany(taskDocs, { ordered: false }).catch(() => {})
      importedCount += taskDocs.length
    }

    // Import Notes
    if (Array.isArray(notes) && notes.length > 0) {
      const noteDocs = notes.map(n => ({
        owner,
        title: n.title || 'Imported Note',
        content: n.content || '',
        tags: Array.isArray(n.tags) ? n.tags : [],
      }))
      await Note.insertMany(noteDocs, { ordered: false }).catch(() => {})
      importedCount += noteDocs.length
    }

    // Import Snippets
    if (Array.isArray(snippets) && snippets.length > 0) {
      const snippetDocs = snippets.map(s => ({
        owner,
        title: s.title || 'Imported Snippet',
        code: s.code || '',
        language: s.language || 'javascript',
        description: s.description || '',
      }))
      await Snippet.insertMany(snippetDocs, { ordered: false }).catch(() => {})
      importedCount += snippetDocs.length
    }

    await recordActivity(owner, 'project', 'workspace_imported', 'project_updated', `Imported ${importedCount} workspace records from backup`, {}).catch(() => {})

    return res.json({
      success: true,
      message: `Successfully imported ${importedCount} items into your workspace!`,
      importedCount,
    })
  } catch (error) {
    return next(error)
  }
}
