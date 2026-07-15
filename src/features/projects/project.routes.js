import { Router } from 'express'
import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from './project.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All project routes require authentication
router.use(requireAuth)

router.get('/', getProjects)
router.post('/', createProject)
router.get('/:id', getProject)
router.patch('/:id', updateProject)
router.delete('/:id', deleteProject)

export default router
