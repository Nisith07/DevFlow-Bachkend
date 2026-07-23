import mongoose from 'mongoose'

/**
 * Tracks focused work sessions (Pomodoro or Deep Work) per user.
 * The frontend starts a session, optionally links it to a task/project,
 * logs interruptions, and marks it complete or abandoned.
 */
const focusSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Optional links to project/task being worked on
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    // Session mode
    mode: {
      type: String,
      enum: ['pomodoro', 'deep_work'],
      default: 'pomodoro',
    },
    // Target duration in minutes (25 for pomodoro, custom for deep work)
    targetMinutes: {
      type: Number,
      required: true,
      default: 25,
    },
    // Actual duration once completed/abandoned
    actualMinutes: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    // Each interruption is logged with timestamp and optional note
    interruptions: [
      {
        at: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
    // Optional label for what was worked on
    label: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: true }
)

focusSessionSchema.index({ owner: 1, startedAt: -1 })
focusSessionSchema.index({ owner: 1, status: 1 })

export default mongoose.model('FocusSession', focusSessionSchema)
