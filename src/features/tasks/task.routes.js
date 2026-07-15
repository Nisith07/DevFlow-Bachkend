import { Router } from 'express'
import {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  completeTask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
} from './task.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

router.get('/', getTasks)
router.post('/', createTask)
router.get('/:id', getTask)
router.patch('/:id', updateTask)
router.delete('/:id', deleteTask)
router.post('/:id/complete', completeTask)

// Subtasks routes
router.post('/:id/subtasks', addSubtask)
router.patch('/:id/subtasks/:subId', updateSubtask)
router.delete('/:id/subtasks/:subId', deleteSubtask)

export default router
