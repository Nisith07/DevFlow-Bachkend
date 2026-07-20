import mongoose from 'mongoose'

const plannerEntrySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    startTime: {
      type: String, // "HH:MM" e.g., "09:00"
      trim: true,
    },
    endTime: {
      type: String, // "HH:MM" e.g., "10:30"
      trim: true,
    },
    done: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['focus_task', 'meeting', 'routine', 'other'],
      default: 'focus_task',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

// Index on owner + date for fast retrieval of daily plan
plannerEntrySchema.index({ owner: 1, date: 1 })

export default mongoose.model('PlannerEntry', plannerEntrySchema)
