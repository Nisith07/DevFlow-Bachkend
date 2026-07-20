import { Router } from 'express'
import {
  getIssues,
  createIssue,
  getIssue,
  updateIssue,
  deleteIssue,
  addIssueComment,
  deleteIssueComment
} from './issue.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

router.get('/', getIssues)
router.post('/', createIssue)
router.get('/:id', getIssue)
router.patch('/:id', updateIssue)
router.delete('/:id', deleteIssue)

// Comments routes
router.post('/:id/comments', addIssueComment)
router.delete('/:id/comments/:commentId', deleteIssueComment)

export default router
