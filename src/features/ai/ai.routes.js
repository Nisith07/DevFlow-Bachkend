import { Router } from 'express'
import {
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  postMessage,
} from './ai.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getConversations)
router.post('/', createConversation)
router.get('/:id', getConversation)
router.delete('/:id', deleteConversation)
router.post('/:id/messages', postMessage)

export default router
