import { Router } from 'express'
import {
  getIntegrations,
  saveIntegration,
} from './integration.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getIntegrations)
router.post('/', saveIntegration)

export default router
