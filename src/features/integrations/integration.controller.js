import Integration from './integration.model.js'

export async function getIntegrations(req, res, next) {
  try {
    const owner = req.user._id
    let config = await Integration.findOne({ owner })

    if (!config) {
      config = await Integration.create({
        owner,
        github: { token: '', connected: false },
        google: { connected: false },
        slack: { webhookUrl: '', channel: '', connected: false },
        discord: { webhookUrl: '', connected: false },
        notion: { apiToken: '', connected: false },
        jira: { serverUrl: '', apiToken: '', connected: false },
        vercel: { apiToken: '', projectId: '', connected: false },
        render: { apiToken: '', serviceId: '', connected: false },
        mongoAtlas: { connectionString: '', connected: false }
      })
    }

    const obj = config.toObject()
    obj.id = config._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function saveIntegration(req, res, next) {
  try {
    const owner = req.user._id
    const updates = req.body

    const config = await Integration.findOneAndUpdate(
      { owner },
      { $set: updates },
      { new: true, upsert: true }
    )

    const obj = config.toObject()
    obj.id = config._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}
