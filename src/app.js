import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import passport from 'passport'
import authRoutes from './routes/authRoutes.js'

export function createApp(googleEnabled) {
  const app = express()
  app.locals.googleEnabled = googleEnabled
  app.use(helmet())
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  app.use(passport.initialize())

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }), authRoutes)

  app.use((err, _req, res, _next) => {
    console.error(err)
    if (err?.code === 11000) return res.status(409).json({ message: 'An account already exists for this email.' })
    return res.status(500).json({ message: 'Something went wrong. Please try again.' })
  })
  return app
}
