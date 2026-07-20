import { Router } from 'express'
import {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  completeTask,
  reorderTasks,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  addTaskComment,
  deleteTaskComment,
  addTaskAttachment,
  deleteTaskAttachment,
} from './task.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

router.get('/', getTasks)
router.post('/', createTask)
router.patch('/reorder', reorderTasks) // Must be before /:id
router.get('/:id', getTask)
router.patch('/:id', updateTask)
router.delete('/:id', deleteTask)
router.post('/:id/complete', completeTask)

// Subtasks routes
router.post('/:id/subtasks', addSubtask)
router.patch('/:id/subtasks/:subId', updateSubtask)
router.delete('/:id/subtasks/:subId', deleteSubtask)

// Comments routes
router.post('/:id/comments', addTaskComment)
router.delete('/:id/comments/:commentId', deleteTaskComment)

// Attachments routes
router.post('/:id/attachments', addTaskAttachment)
router.delete('/:id/attachments/:attachmentId', deleteTaskAttachment)

export default router
