import mongoose from 'mongoose'
import { setServers } from 'dns'

export async function connectDatabase() {
  // Override the default loopback DNS client stub on Windows if it is not binding/running.
  if (process.platform === 'win32') {
    setServers(['8.8.8.8', '1.1.1.1'])
  }

  const { MONGODB_URI } = process.env

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Add it to DevFlow-Backend/.env.')
  }

  await mongoose.connect(MONGODB_URI)
  console.log(`MongoDB connected: ${mongoose.connection.host}`)
}
