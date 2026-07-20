import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
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
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: 'Untitled Note',
    },
    body: {
      type: String,
      maxlength: 50000,
      default: '',
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    folder: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
)

// Index for listing user's notes sorted by pin status and update time
noteSchema.index({ owner: 1, isPinned: -1, updatedAt: -1 })

export default mongoose.model('Note', noteSchema)
