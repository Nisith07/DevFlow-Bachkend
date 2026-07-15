import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function requireAuth(req, res, next) {
  try {
    let token = req.cookies.devflow_token
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }
    if (!token) return res.status(401).json({ message: 'Authentication is required.' })

    const { sub } = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(sub)
    if (!user) return res.status(401).json({ message: 'Session is no longer valid.' })

    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Session is invalid or expired.' })
  }
}
