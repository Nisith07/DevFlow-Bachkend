import { Router } from 'express'
import { globalSearch } from './search.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)
router.get('/', globalSearch)

export default router
