import { Router } from 'express'
import {
  getTokenStatus,
  saveToken,
  deleteToken,
  getRepos,
  createRepo,
  getBranches,
  getPullRequests,
  getCommits,
  getReleases,
  getRepoDetails,
} from './github.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

// OAuth / Token management
router.get('/token', getTokenStatus)
router.post('/token', saveToken)
router.delete('/token', deleteToken)

// Repos listing & creation
router.get('/repos', getRepos)
router.post('/repos', createRepo)

// Repo assets proxy endpoints
router.get('/repos/:owner/:repo', getRepoDetails)
router.get('/repos/:owner/:repo/branches', getBranches)
router.get('/repos/:owner/:repo/pulls', getPullRequests)
router.get('/repos/:owner/:repo/commits', getCommits)
router.get('/repos/:owner/:repo/releases', getReleases)

export default router
