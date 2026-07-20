import { Router } from 'express'
import {
  startOAuth,
  handleOAuthCallback,
  getTokenStatus,
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

// ── GitHub OAuth flow ─────────────────────────────────────────────────────────
// Start: user must be logged in so we can embed their userId in the state token
router.get('/oauth/start', requireAuth, startOAuth)

// Callback: public — GitHub redirects here after the user authorizes.
// State JWT is used to identify the user instead of a session cookie.
router.get('/oauth/callback', handleOAuthCallback)

// ── All routes below require DevFlow authentication ───────────────────────────
router.use(requireAuth)

// Token / connection status & disconnect
router.get('/token', getTokenStatus)
router.delete('/token', deleteToken)

// Repos listing & creation
router.get('/repos', getRepos)
router.post('/repos', createRepo)

// Per-repo asset proxy endpoints
router.get('/repos/:owner/:repo', getRepoDetails)
router.get('/repos/:owner/:repo/branches', getBranches)
router.get('/repos/:owner/:repo/pulls', getPullRequests)
router.get('/repos/:owner/:repo/commits', getCommits)
router.get('/repos/:owner/:repo/releases', getReleases)

export default router
