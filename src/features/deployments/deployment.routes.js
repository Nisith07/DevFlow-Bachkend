import { Router } from 'express'
import {
  getDeployments,
  getDeployment,
  createDeployment,
  updateDeployment,
  rollbackDeployment,
  deleteDeployment,
} from './deployment.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getDeployments)
router.post('/', createDeployment)
router.get('/:id', getDeployment)
router.patch('/:id', updateDeployment)
router.delete('/:id', deleteDeployment)

// Rollback: creates a new deployment record pinned as production
router.post('/:id/rollback', rollbackDeployment)

export default router
