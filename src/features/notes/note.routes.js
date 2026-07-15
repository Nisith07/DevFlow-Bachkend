import { Router } from 'express'
import {
  getNotes,
  createNote,
  getNote,
  updateNote,
  deleteNote,
  togglePinNote,
} from './note.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

// All routes require auth
router.use(requireAuth)

router.get('/', getNotes)
router.post('/', createNote)
router.get('/:id', getNote)
router.patch('/:id', updateNote)
router.delete('/:id', deleteNote)
router.post('/:id/pin', togglePinNote)

export default router
