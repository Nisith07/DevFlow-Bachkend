import 'dotenv/config'
import passport from 'passport'
import { connectDatabase } from './config/database.js'
import { configurePassport } from './config/passport.js'
import { createApp } from './app.js'

const required = ['JWT_SECRET', 'CLIENT_URL']
const missing = required.filter((key) => !process.env[key])
if (missing.length) throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`)

const googleEnabled = configurePassport(passport)
const app = createApp(googleEnabled)
const port = Number(process.env.PORT || 5000)

connectDatabase()
  .then(() => app.listen(port, () => console.log(`DevFlow API listening at http://localhost:${port}`)))
  .catch((error) => {
    console.error('Unable to start DevFlow API:', error.message)
    process.exit(1)
  })
