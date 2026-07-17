import Notification from './notification.model.js'

export async function getNotifications(req, res, next) {
  try {
    const owner = req.user._id
    const notifications = await Notification.find({ owner })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    return res.json({ data: notifications })
  } catch (error) {
    return next(error)
  }
}

export async function markAsRead(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const notification = await Notification.findOneAndUpdate(
      { _id: id, owner },
      { isRead: true },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    return res.json({ data: notification })
  } catch (error) {
    return next(error)
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const owner = req.user._id
    await Notification.updateMany({ owner, isRead: false }, { isRead: true })
    return res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    return next(error)
  }
}
