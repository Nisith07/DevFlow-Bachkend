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
  getProjectMemory,
  refreshProjectMemory,
  generateDailyBriefing,
} from './ai.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// Daily briefing
router.post('/briefing', generateDailyBriefing)

// AI Task estimate
router.post('/estimate-task', estimateTask)

// Developer Copilot Tool routes (must be before /:id)
router.get('/copilot/history', getCopilotHistory)
router.post('/copilot/run', runCopilotTool)
router.patch('/copilot/history/:id', updateCopilotHistory)
router.delete('/copilot/history/:id', deleteCopilotHistory)

// Project Memory routes
router.get('/projects/:projectId/memory', getProjectMemory)
router.post('/projects/:projectId/memory/refresh', refreshProjectMemory)

// Chat / Conversation routes
router.get('/', getConversations)
router.post('/', createConversation)
router.get('/:id', getConversation)
router.delete('/:id', deleteConversation)
router.post('/:id/messages', postMessage)

export default router
