import mongoose from 'mongoose'

const subtaskSchema = new mongoose.Schema({
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
  order: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const taskSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'urgent'],
      default: 'none',
    },
    dueDate: {
      type: Date,
    },
    dueTime: {
      type: String,
      trim: true,
      default: '',
    },
    labels: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
    isToday: {
      type: Boolean,
      default: false,
    },
    plannedDate: {
      type: Date,
    },
    sprint: {
      type: String,
      trim: true,
      default: '',
    },
    boardPosition: {
      type: Number,
      default: 0,
    },
    aiEstimate: {
      type: String,
      trim: true,
      default: '',
    },
    subtasks: {
      type: [subtaskSchema],
      default: [],
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

// Compound indexes
taskSchema.index({ owner: 1, status: 1 })
taskSchema.index({ owner: 1, isToday: 1, plannedDate: 1 })
taskSchema.index({ project: 1, status: 1 })
taskSchema.index({ owner: 1, dueDate: 1 })
taskSchema.index({ owner: 1, completedAt: 1 })

export default mongoose.model('Task', taskSchema)
