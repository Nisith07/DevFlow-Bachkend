import axios from 'axios'
import User from '../../models/User.js'

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

// Check if user has token configured
export async function getTokenStatus(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    return res.json({ data: { hasToken: !!user.githubToken } })
  } catch (error) {
    return next(error)
  }
}

// Save token
export async function saveToken(req, res, next) {
  try {
    const { token } = req.body
    if (!token || !token.trim()) {
      return res.status(400).json({ message: 'GitHub token is required.' })
    }

    // Quick verification check on GitHub API
    try {
      const client = getGitHubClient(token.trim())
      await client.get('/user')
    } catch (err) {
      return res.status(400).json({ message: 'Invalid GitHub token. Please verify permissions.' })
    }

    await User.findByIdAndUpdate(req.user._id, { githubToken: token.trim() })
    return res.json({ data: { hasToken: true } })
  } catch (error) {
    return next(error)
  }
}

// Remove token
export async function deleteToken(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user._id, { githubToken: undefined })
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

// Get GitHub Repos
export async function getRepos(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required. Please set up authentication.' })
    }

    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get('/user/repos?per_page=100&sort=updated')
    
    // Map minimal data to keep it small and fast
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

// Create Repo
export async function createRepo(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required.' })
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

// Get branches
export async function getBranches(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required.' })
    }

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/branches`)

    const mapped = data.map(b => ({
      name: b.name,
      protected: b.protected
    }))
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

// Get PRs
export async function getPullRequests(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required.' })
    }

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=30`)

    const mapped = data.map(p => ({
      id: p.id,
      number: p.number,
      title: p.title,
      state: p.state,
      user: p.user.login,
      htmlUrl: p.html_url,
      createdAt: p.created_at,
      closedAt: p.closed_at
    }))
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

// Get commits
export async function getCommits(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required.' })
    }

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/commits?per_page=30`)

    const mapped = data.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author.name,
      date: c.commit.author.date,
      htmlUrl: c.html_url
    }))
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

// Get releases
export async function getReleases(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required.' })
    }

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}/releases?per_page=30`)

    const mapped = data.map(r => ({
      id: r.id,
      tagName: r.tag_name,
      name: r.name,
      publishedAt: r.published_at,
      htmlUrl: r.html_url
    }))
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

// Get details (stars, forks, open issues count, clone URL)
export async function getRepoDetails(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+githubToken')
    if (!user.githubToken) {
      return res.status(401).json({ message: 'GitHub token required.' })
    }

    const { owner, repo } = req.params
    const client = getGitHubClient(user.githubToken)
    const { data } = await client.get(`/repos/${owner}/${repo}`)

    return res.json({
      data: {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        cloneUrl: data.clone_url,
        htmlUrl: data.html_url,
        description: data.description,
        defaultBranch: data.default_branch
      }
    })
  } catch (error) {
    return next(error)
  }
}
