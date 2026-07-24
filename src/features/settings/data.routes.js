import { Router } from 'express'
import { exportWorkspaceData, importWorkspaceData } from './data.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/export', exportWorkspaceData)
router.post('/import', importWorkspaceData)

export default router
