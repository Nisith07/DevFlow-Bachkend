import mongoose from 'mongoose'

/**
 * Stores AI-generated memory summaries for each project.
 * Updated whenever the user triggers "Refresh AI Memory" or automatically
 * after significant project activity (task completions, new notes, etc.).
 */
const projectMemorySchema = new mongoose.Schema(
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
      required: true,
    },
    // The full AI-generated markdown summary of the project
    summary: {
      type: String,
      default: '',
    },
    // Key decisions, blockers, next steps extracted by AI
    keyInsights: {
      type: [String],
      default: [],
    },
    // The context that was fed to the AI to generate this summary
    contextSnapshot: {
      taskCount: { type: Number, default: 0 },
      completedCount: { type: Number, default: 0 },
      noteCount: { type: Number, default: 0 },
      issueCount: { type: Number, default: 0 },
    },
    // When this memory was last refreshed
    refreshedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

// One memory doc per project per owner
projectMemorySchema.index({ owner: 1, project: 1 }, { unique: true })

export default mongoose.model('ProjectMemory', projectMemorySchema)
