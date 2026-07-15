import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    color: {
      type: String,
      default: '#4FB8A8',
    },
    icon: {
      type: String,
      default: '📁',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'archived'],
      default: 'active',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
)

// Compound indexes for common queries
projectSchema.index({ owner: 1, status: 1 })
projectSchema.index({ owner: 1, dueDate: 1 })

export default mongoose.model('Project', projectSchema)
