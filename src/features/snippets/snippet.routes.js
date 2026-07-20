import { Router } from 'express'
import {
  getSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  toggleFavoriteSnippet
} from './snippet.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getSnippets)
router.post('/', createSnippet)
router.patch('/:id', updateSnippet)
router.delete('/:id', deleteSnippet)
router.post('/:id/favorite', toggleFavoriteSnippet)

export default router
