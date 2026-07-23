import { Router } from 'express'
import {
  startSession,
  endSession,
  logInterruption,
  getActiveSession,
  getSessions,
  getFocusStats,
  getFocusNudge,
} from './focus.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

// Session management
router.get('/active', getActiveSession)         // GET  /api/v1/focus/active
router.post('/sessions', startSession)          // POST /api/v1/focus/sessions
router.patch('/sessions/:id/end', endSession)   // PATCH /api/v1/focus/sessions/:id/end
router.post('/sessions/:id/interrupt', logInterruption) // POST /api/v1/focus/sessions/:id/interrupt
router.get('/sessions', getSessions)            // GET  /api/v1/focus/sessions

// Analytics
router.get('/stats', getFocusStats)             // GET  /api/v1/focus/stats
router.get('/nudge', getFocusNudge)             // GET  /api/v1/focus/nudge

export default router
