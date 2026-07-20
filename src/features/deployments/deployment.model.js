import mongoose from 'mongoose'

/**
 * Deployment records track every deployment event for a user's projects.
 * Build logs are stored as an array of log line objects for rich display.
 */
const deploymentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Human-readable project/service name
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    // Git branch that was deployed
    branch: {
      type: String,
      default: 'main',
      trim: true,
    },
    // Short git commit SHA
    commitSha: {
      type: String,
      trim: true,
      default: '',
    },
    // Commit message
    commitMessage: {
      type: String,
      trim: true,
      default: '',
    },
    // Deployment platform
    environment: {
      type: String,
      enum: ['production', 'staging', 'preview', 'development'],
      default: 'production',
      index: true,
    },
    // Overall status
    status: {
      type: String,
      enum: ['running', 'success', 'failed', 'cancelled', 'rolled_back'],
      default: 'running',
      index: true,
    },
    // Which build step failed, if any
    failedStep: {
      type: String,
      default: '',
    },
    // Duration in seconds
    duration: {
      type: Number,
      default: 0,
    },
    // Deployment URL (live link)
    url: {
      type: String,
      default: '',
    },
    // Platform: render, vercel, netlify, railway, fly, custom
    platform: {
      type: String,
      enum: ['render', 'vercel', 'netlify', 'railway', 'fly', 'custom'],
      default: 'render',
    },
    // Whether this is the current production deployment
    isProduction: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Structured build log lines: { level: 'info'|'warn'|'error', message: string }
    logs: [
      {
        level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
)

deploymentSchema.index({ owner: 1, createdAt: -1 })

export default mongoose.model('Deployment', deploymentSchema)
