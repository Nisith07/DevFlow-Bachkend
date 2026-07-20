import { Router } from 'express'
import {
  getResume,
  saveResume,
  aiImproveResume,
  aiSkillsSuggestions,
  importLinkedIn,
} from './resume.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getResume)
router.post('/', saveResume)
router.post('/ai-improve', aiImproveResume)
router.post('/ai-skills', aiSkillsSuggestions)
router.post('/import-linkedin', importLinkedIn)

export default router
