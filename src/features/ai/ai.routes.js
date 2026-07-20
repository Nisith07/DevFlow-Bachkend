import { Router } from 'express'
import {
  getConversations,
  createConversation,
  getConversation,
  deleteConversation,
  postMessage,
  estimateTask,
  getCopilotHistory,
  runCopilotTool,
  updateCopilotHistory,
  deleteCopilotHistory,
} from './ai.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// Chats Routes
router.get('/', getConversations)
router.post('/', createConversation)
router.post('/estimate-task', estimateTask)
router.get('/:id', getConversation)
router.delete('/:id', deleteConversation)
router.post('/:id/messages', postMessage)

// Developer Copilot Tool routes
router.get('/copilot/history', getCopilotHistory)
router.post('/copilot/run', runCopilotTool)
router.patch('/copilot/history/:id', updateCopilotHistory)
router.delete('/copilot/history/:id', deleteCopilotHistory)

export default router
