import axios from 'axios'
import jwt from 'jsonwebtoken'
import User from '../../models/User.js'

// ── Shared GitHub API client factory ──────────────────────────────────────────
function getGitHubClient(token) {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'DevFlow-App'
    }
  })
}

// ── OAuth: Initiate GitHub Authorization ──────────────────────────────────────
// GET /api/v1/github/oauth/start  (requireAuth guards this)
export function startOAuth(req, res) {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CALLBACK_URL) {
    return res.status(503).json({ message: 'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CALLBACK_URL.' })
  }

  // Encode the authenticated user ID into the state token so the callback
  // knows which DB document to update without relying on a session cookie.
  const state = jwt.sign({ userId: req.user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '10m' })

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'repo read:user',
    state,
    allow_signup: 'true',
    prompt: 'consent',
  })

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`)
}

// ── OAuth: Handle GitHub Callback ─────────────────────────────────────────────
// GET /api/v1/github/oauth/callback  (public — no requireAuth)
export async function handleOAuthCallback(req, res, next) {
  try {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    const { code, state, error } = req.query

    if (error) {
      return res.redirect(`${clientUrl}/github?github_error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return res.redirect(`${clientUrl}/github?github_error=missing_params`)
    }

    // Verify state JWT to retrieve the userId
    let userId
    try {
      const payload = jwt.verify(state, process.env.JWT_SECRET)
      userId = payload.userId
    } catch {
      return res.redirect(`${clientUrl}/github?github_error=invalid_state`)
    }

    // Exchange code for access token at GitHub
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
      },
      { headers: { Accept: 'application/json' } }
    )

    const { access_token, error: tokenError } = tokenResponse.data
    if (tokenError || !access_token) {
      const msg = tokenError || 'token_exchange_failed'
      return res.redirect(`${clientUrl}/github?github_error=${encodeURIComponent(msg)}`)
    }

    // Persist the OAuth token and mark GitHub as connected
    await User.findByIdAndUpdate(userId, {
      githubToken: access_token,
      'settings.connectedAccounts.githubConnected': true,
    })

    return res.redirect(`${clientUrl}/github?connected=1`)
  } catch (error) {
    return next(error)
  }
}

// ── Token status ──────────────────────────────────────────────────────────────
export async function getTokenStatus(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    return res.json({ data: { hasToken: !!user.githubToken } })
  } catch (error) {
    return next(error)
  }
}

// ── Disconnect / remove token ─────────────────────────────────────────────────
export async function deleteToken(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { githubToken: '' },
      'settings.connectedAccounts.githubConnected': false,
    })
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

// ── Repos listing ─────────────────────────────────────────────────────────────
export async function getRepos(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub not connected. Please authorize via GitHub OAuth.' })
    }

    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get('/user/repos?per_page=100&sort=updated')

    const mapped = data.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      description: r.description,
      private: r.private,
      htmlUrl: r.html_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      cloneUrl: r.clone_url,
      defaultBranch: r.default_branch
    }))

    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

// ── Create Repo ───────────────────────────────────────────────────────────────
export async function createRepo(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub not connected.' })
    }

    const { name, description, isPrivate } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Repository name is required.' })
    }

    const client = getGitHubClient(user.githubToken)
    const { data } = await client.post('/user/repos', {
      name: name.trim(),
      description: description?.trim() || '',
      private: !!isPrivate
    })

    return res.status(201).json({
      data: {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        htmlUrl: data.html_url,
        cloneUrl: data.clone_url
      }
    })
  } catch (error) {
    if (error.response?.data) {
      return res.status(error.response.status).json({ message: error.response.data.message })
    }
    return next(error)
  }
}

// ── Branches ──────────────────────────────────────────────────────────────────
export async function getBranches(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) return res.status(401).json({ message: 'GitHub not connected.' })

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/branches`)

    return res.json({ data: data.map(b => ({ name: b.name, protected: b.protected })) })
  } catch (error) {
    return next(error)
  }
}

// ── Pull Requests ─────────────────────────────────────────────────────────────
export async function getPullRequests(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) return res.status(401).json({ message: 'GitHub not connected.' })

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=30`)

    return res.json({
      data: data.map(p => ({
        id: p.id, number: p.number, title: p.title, state: p.state,
        user: p.user.login, htmlUrl: p.html_url, createdAt: p.created_at, closedAt: p.closed_at
      }))
    })
  } catch (error) {
    return next(error)
  }
}

// ── Commits ───────────────────────────────────────────────────────────────────
export async function getCommits(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) return res.status(401).json({ message: 'GitHub not connected.' })

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/commits?per_page=30`)

    return res.json({
      data: data.map(c => ({
        sha: c.sha, message: c.commit.message,
        author: c.commit.author.name, date: c.commit.author.date, htmlUrl: c.html_url
      }))
    })
  } catch (error) {
    return next(error)
  }
}

// ── Releases ──────────────────────────────────────────────────────────────────
export async function getReleases(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) return res.status(401).json({ message: 'GitHub not connected.' })

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/releases?per_page=30`)

    return res.json({
      data: data.map(r => ({
        id: r.id, tagName: r.tag_name, name: r.name,
        publishedAt: r.published_at, htmlUrl: r.html_url
      }))
    })
  } catch (error) {
    return next(error)
  }
}

// ── Repo Details ──────────────────────────────────────────────────────────────
export async function getRepoDetails(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) return res.status(401).json({ message: 'GitHub not connected.' })

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}`)

    return res.json({
      data: {
        id: data.id, name: data.name, fullName: data.full_name,
        stars: data.stargazers_count, forks: data.forks_count,
        openIssues: data.open_issues_count, cloneUrl: data.clone_url,
        htmlUrl: data.html_url, description: data.description,
        defaultBranch: data.default_branch
      }
    })
  } catch (error) {
    return next(error)
  }
}
