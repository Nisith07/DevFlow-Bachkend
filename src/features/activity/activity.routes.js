import { Router } from 'express'
import { getActivity } from './activity.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getActivity)

export default router
