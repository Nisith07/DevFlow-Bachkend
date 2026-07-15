import { Router } from 'express'
import {
  getPlannerEntries,
  createPlannerEntry,
  updatePlannerEntry,
  deletePlannerEntry,
  reorderPlannerEntries,
} from './planner.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

router.get('/', getPlannerEntries)
router.post('/', createPlannerEntry)
router.put('/reorder', reorderPlannerEntries)
router.patch('/:id', updatePlannerEntry)
router.delete('/:id', deletePlannerEntry)

export default router
