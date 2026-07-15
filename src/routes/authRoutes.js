import { Router } from 'express'
import bcrypt from 'bcryptjs'
import passport from 'passport'
import User from '../models/User.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { cookieOptions, sendSession, createToken } from '../utils/auth.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizedEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

router.post('/signup', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const email = normalizedEmail(req.body.email)
    const { password } = req.body

    if (!name || !emailPattern.test(email) || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Enter a name, valid email, and password of at least 8 characters.' })
    }
    if (name.length > 80) return res.status(400).json({ message: 'Name must be 80 characters or fewer.' })
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account already exists for this email.' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: passwordHash, providers: ['password'], lastLoginAt: new Date() })
    return sendSession(res, user, 201)
  } catch (error) {
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizedEmail(req.body.email)
    const { password } = req.body
    if (!email || typeof password !== 'string') return res.status(400).json({ message: 'Email and password are required.' })

    const user = await User.findOne({ email }).select('+password')
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Incorrect email or password.' })
    }
    user.lastLoginAt = new Date()
    await user.save()
    return sendSession(res, user)
  } catch (error) {
    return next(error)
  }
})

router.get('/google', (req, res, next) => {
  if (!req.app.locals.googleEnabled) return res.status(503).json({ message: 'Google sign-in has not been configured.' })
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

router.get('/google/callback', (req, res, next) => {
  if (!req.app.locals.googleEnabled) return res.redirect(`${process.env.CLIENT_URL}/?authError=google-not-configured`)
  passport.authenticate('google', { session: false }, (error, user) => {
    if (error || !user) return res.redirect(`${process.env.CLIENT_URL}/?authError=google-sign-in-failed`)
    const token = createToken(user._id)
    return res
      .cookie('devflow_token', token, cookieOptions)
      .redirect(`${process.env.CLIENT_URL}/?auth=success&token=${token}`)
  })(req, res, next)
})

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeObject() }))

router.post('/logout', (req, res) => res.clearCookie('devflow_token', cookieOptions).status(204).send())

export default router
