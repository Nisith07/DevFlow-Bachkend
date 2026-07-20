import { Router } from 'express'
import {
  getPlannerEntries,
  createPlannerEntry,
  updatePlannerEntry,
  deletePlannerEntry,
  reorderPlannerEntries,
  getWeeklyGoals,
  createWeeklyGoal,
  updateWeeklyGoal,
  deleteWeeklyGoal,
} from './planner.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

// Daily Entries
router.get('/', getPlannerEntries)
router.post('/', createPlannerEntry)
router.put('/reorder', reorderPlannerEntries)
router.patch('/:id', updatePlannerEntry)
router.delete('/:id', deletePlannerEntry)

// Weekly Goals
router.get('/weekly', getWeeklyGoals)
router.post('/weekly', createWeeklyGoal)
router.patch('/weekly/:id', updateWeeklyGoal)
router.delete('/weekly/:id', deleteWeeklyGoal)

export default router
