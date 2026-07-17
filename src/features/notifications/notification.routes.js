import { Router } from 'express'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from './notification.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getNotifications)
router.post('/read-all', markAllAsRead)
router.patch('/:id/read', markAsRead)

export default router
