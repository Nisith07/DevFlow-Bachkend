import { Router } from 'express'
import {
  getPortfolio,
  savePortfolio,
  addPortfolioMessage,
  deployPortfolio,
} from './portfolio.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', getPortfolio)
router.post('/', savePortfolio)
router.post('/messages', addPortfolioMessage)
router.post('/deploy', deployPortfolio)

export default router
