import Deployment from './deployment.model.js'

// ── Seed realistic demo data if user has no deployments ──────────────────────
async function seedDeployments(owner) {
  const DEMO = [
    {
      owner,
      projectName: 'DevFlow Backend API',
      branch: 'main',
      commitSha: '2baad1d',
      commitMessage: 'fix: add searchRoutes import to app.js',
      environment: 'production',
      platform: 'render',
      status: 'success',
      duration: 47,
      url: 'https://devflow-backend-53bm.onrender.com',
      isProduction: true,
      logs: [
        { level: 'info', message: '==> Cloning from https://github.com/Nisith07/DevFlow-Backend' },
        { level: 'info', message: '==> Checking out commit 2baad1d in branch main' },
        { level: 'info', message: '==> Using Node.js version 24.14.1' },
        { level: 'info', message: '==> Running build command: npm install' },
        { level: 'info', message: 'up to date, audited 151 packages in 544ms' },
        { level: 'info', message: '==> Build successful 🎉' },
        { level: 'info', message: '==> Running npm run start' },
        { level: 'info', message: 'MongoDB connected: ac-wxu1977-shard-00-00.mongodb.net' },
        { level: 'info', message: 'DevFlow API listening at http://0.0.0.0:5000' },
      ],
    },
    {
      owner,
      projectName: 'DevFlow Frontend',
      branch: 'main',
      commitSha: 'a1f3c2b',
      commitMessage: 'feat: GitHub OAuth integration — replace PAT flow',
      environment: 'production',
      platform: 'vercel',
      status: 'success',
      duration: 32,
      url: 'https://devflow-nisith.vercel.app',
      isProduction: false,
      logs: [
        { level: 'info', message: 'Vercel CLI 39.1.0' },
        { level: 'info', message: '🔍 Inspect: https://vercel.com/nisith/devflow' },
        { level: 'info', message: 'Running "npm run build"' },
        { level: 'info', message: 'vite v8.1.4 building for production...' },
        { level: 'info', message: '✓ 1978 modules transformed.' },
        { level: 'info', message: 'dist/assets/index.js  965.60 kB │ gzip: 269.28 kB' },
        { level: 'warn', message: 'Some chunks are larger than 500 kB after minification.' },
        { level: 'info', message: '✓ Built in 390ms' },
        { level: 'info', message: '✅ Deployment complete. https://devflow-nisith.vercel.app' },
      ],
    },
    {
      owner,
      projectName: 'DevFlow Backend API',
      branch: 'feature/analytics',
      commitSha: 'f8e1099',
      commitMessage: 'feat: analytics queries endpoint with ai usage data',
      environment: 'staging',
      platform: 'render',
      status: 'failed',
      duration: 23,
      url: '',
      failedStep: 'npm run start',
      isProduction: false,
      logs: [
        { level: 'info', message: '==> Cloning branch feature/analytics' },
        { level: 'info', message: '==> Running build command: npm install' },
        { level: 'info', message: '==> Build successful 🎉' },
        { level: 'info', message: '==> Running npm run start' },
        { level: 'error', message: 'Error [ERR_MODULE_NOT_FOUND]: Cannot find package \'axios\'' },
        { level: 'error', message: 'at packageResolve (node:internal/modules/esm/resolve:768:81)' },
        { level: 'error', message: '==> Deploy failed ❌' },
      ],
    },
    {
      owner,
      projectName: 'Portfolio Site',
      branch: 'main',
      commitSha: 'b2c7d3a',
      commitMessage: 'style: update hero section gradient and animations',
      environment: 'production',
      platform: 'vercel',
      status: 'success',
      duration: 18,
      url: 'https://nisith.vercel.app',
      isProduction: false,
      logs: [
        { level: 'info', message: 'Building portfolio project...' },
        { level: 'info', message: 'Running "npm run build"' },
        { level: 'info', message: '✓ Built in 180ms' },
        { level: 'info', message: '✅ Deployment complete.' },
      ],
    },
    {
      owner,
      projectName: 'DevFlow Backend API',
      branch: 'main',
      commitSha: 'd4e9f12',
      commitMessage: 'chore: add axios to package.json dependencies',
      environment: 'production',
      platform: 'render',
      status: 'rolled_back',
      duration: 55,
      url: 'https://devflow-backend-53bm.onrender.com',
      isProduction: false,
      logs: [
        { level: 'info', message: '==> Build successful 🎉' },
        { level: 'info', message: '==> Running npm run start' },
        { level: 'warn', message: 'High memory usage detected: 87%' },
        { level: 'error', message: 'Server health check failed after 30s' },
        { level: 'warn', message: '==> Rolling back to previous deployment...' },
        { level: 'info', message: '==> Rollback complete. Previous version restored.' },
      ],
    },
  ]

  // Stagger creation times to mimic a realistic history
  const now = Date.now()
  const offsets = [0, 3 * 3600000, 6 * 3600000, 24 * 3600000, 30 * 3600000]
  const docs = DEMO.map((d, i) => ({
    ...d,
    createdAt: new Date(now - offsets[i]),
    updatedAt: new Date(now - offsets[i]),
  }))

  await Deployment.insertMany(docs)
}

// ── List deployments ──────────────────────────────────────────────────────────
export async function getDeployments(req, res, next) {
  try {
    const owner = req.user._id

    let deployments = await Deployment.find({ owner })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    // First visit — seed demo data
    if (deployments.length === 0) {
      await seedDeployments(owner)
      deployments = await Deployment.find({ owner })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    }

    return res.json({ data: deployments })
  } catch (error) {
    return next(error)
  }
}

// ── Get single deployment ─────────────────────────────────────────────────────
export async function getDeployment(req, res, next) {
  try {
    const deployment = await Deployment.findOne({ _id: req.params.id, owner: req.user._id }).lean()
    if (!deployment) return res.status(404).json({ message: 'Deployment not found.' })
    return res.json({ data: deployment })
  } catch (error) {
    return next(error)
  }
}

// ── Create deployment ─────────────────────────────────────────────────────────
export async function createDeployment(req, res, next) {
  try {
    const {
      projectName, branch, commitSha, commitMessage,
      environment, platform, status, duration,
      url, failedStep, logs
    } = req.body

    if (!projectName?.trim()) {
      return res.status(400).json({ message: 'Project name is required.' })
    }

    const deployment = await Deployment.create({
      owner: req.user._id,
      projectName: projectName.trim(),
      branch: branch?.trim() || 'main',
      commitSha: commitSha?.trim() || '',
      commitMessage: commitMessage?.trim() || '',
      environment: environment || 'production',
      platform: platform || 'render',
      status: status || 'running',
      duration: duration || 0,
      url: url?.trim() || '',
      failedStep: failedStep?.trim() || '',
      logs: Array.isArray(logs) ? logs : [],
    })

    return res.status(201).json({ data: deployment })
  } catch (error) {
    return next(error)
  }
}

// ── Update deployment (e.g. change status, mark production) ──────────────────
export async function updateDeployment(req, res, next) {
  try {
    const deployment = await Deployment.findOne({ _id: req.params.id, owner: req.user._id })
    if (!deployment) return res.status(404).json({ message: 'Deployment not found.' })

    const allowed = ['status', 'duration', 'url', 'failedStep', 'isProduction', 'logs']
    allowed.forEach(field => {
      if (req.body[field] !== undefined) deployment[field] = req.body[field]
    })

    await deployment.save()
    return res.json({ data: deployment })
  } catch (error) {
    return next(error)
  }
}

// ── Rollback: mark a deployment as the production version ────────────────────
export async function rollbackDeployment(req, res, next) {
  try {
    const owner = req.user._id
    const target = await Deployment.findOne({ _id: req.params.id, owner })
    if (!target) return res.status(404).json({ message: 'Deployment not found.' })

    // Un-mark all production deployments for the same project
    await Deployment.updateMany(
      { owner, projectName: target.projectName, isProduction: true },
      { isProduction: false }
    )

    // Create a new rollback deployment record
    const rollback = await Deployment.create({
      owner,
      projectName: target.projectName,
      branch: target.branch,
      commitSha: target.commitSha,
      commitMessage: `rollback: revert to ${target.commitSha || 'previous version'}`,
      environment: target.environment,
      platform: target.platform,
      status: 'success',
      duration: 8,
      url: target.url,
      isProduction: true,
      logs: [
        { level: 'warn', message: `⏪ Initiating rollback to commit ${target.commitSha}...` },
        { level: 'info', message: '==> Fetching previously built image...' },
        { level: 'info', message: '==> Swapping production traffic to previous version.' },
        { level: 'info', message: `✅ Rollback complete. Now serving commit: ${target.commitSha}` },
      ],
    })

    return res.status(201).json({ data: rollback })
  } catch (error) {
    return next(error)
  }
}

// ── Delete deployment ─────────────────────────────────────────────────────────
export async function deleteDeployment(req, res, next) {
  try {
    const result = await Deployment.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
    if (!result) return res.status(404).json({ message: 'Deployment not found.' })
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
