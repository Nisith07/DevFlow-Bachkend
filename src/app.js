import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import passport from 'passport'
import authRoutes from './routes/authRoutes.js'
import projectRoutes from './features/projects/project.routes.js'
import taskRoutes from './features/tasks/task.routes.js'
import dashboardRoutes from './features/dashboard/dashboard.routes.js'
import plannerRoutes from './features/planner/planner.routes.js'
import noteRoutes from './features/notes/note.routes.js'
import activityRoutes from './features/activity/activity.routes.js'
import analyticsRoutes from './features/analytics/analytics.routes.js'
import aiRoutes from './features/ai/ai.routes.js'
import notificationRoutes from './features/notifications/notification.routes.js'
import searchRoutes from './features/search/search.routes.js'
import { requestId } from './middleware/requestId.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp(googleEnabled) {
  const app = express()
  app.locals.googleEnabled = googleEnabled
  app.use(helmet())
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174'
  ].filter(Boolean)

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true
  }))
  app.use(express.json({ limit: '16kb' }))
  app.use(cookieParser())
  app.use(requestId)
  app.use(passport.initialize())

  const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false })

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.get('/api/v1/health', (req, res) => res.json({ data: { status: 'ok' }, requestId: req.requestId }))

  // Legacy endpoint retained while the current client is migrated to /api/v1.
  app.use('/api/auth', authRateLimit, authRoutes)
  app.use('/api/v1/auth', authRateLimit, authRoutes)

  app.use('/api/v1/projects', projectRoutes)
  app.use('/api/v1/tasks', taskRoutes)
  app.use('/api/v1/dashboard', dashboardRoutes)
  app.use('/api/v1/planner', plannerRoutes)
  app.use('/api/v1/notes', noteRoutes)
  app.use('/api/v1/activity', activityRoutes)
  app.use('/api/v1/analytics', analyticsRoutes)
  app.use('/api/v1/ai', aiRoutes)
  app.use('/api/v1/notifications', notificationRoutes)
  app.use('/api/v1/search', searchRoutes)

  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "DevFlow Backend API is running 🚀",
      version: "v1"
    });
  });

  app.use(notFound)
  app.use(errorHandler)
  return app
}

