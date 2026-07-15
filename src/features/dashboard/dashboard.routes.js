import { Router } from 'express'
import { getDashboardSummary } from './dashboard.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/summary', getDashboardSummary)

export default router
