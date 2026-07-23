import Deployment from './deployment.model.js'


// ── List deployments ──────────────────────────────────────────────────────────
export async function getDeployments(req, res, next) {
  try {
    const owner = req.user._id

    const deployments = await Deployment.find({ owner })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

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
