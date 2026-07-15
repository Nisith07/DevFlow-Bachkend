import { Router } from 'express'
import { getAnalyticsSummary } from './analytics.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/summary', getAnalyticsSummary)

export default router
