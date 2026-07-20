import mongoose from 'mongoose'

const weeklyGoalSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    done: {
      type: Boolean,
      default: false,
    },
    weekIdentifier: {
      type: String, // e.g. "2026-W30"
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

export default mongoose.model('WeeklyGoal', weeklyGoalSchema)
