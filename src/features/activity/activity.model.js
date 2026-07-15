import mongoose from 'mongoose'

/**
 * Activity events are append-only records of user actions across the app.
 * They are written by service functions called from other controllers.
 */
const activitySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Entity type this event relates to
    entityType: {
      type: String,
      enum: ['task', 'project', 'note', 'planner'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Short human-readable description e.g. "Completed task 'Fix login bug'"
    summary: {
      type: String,
      required: true,
      maxlength: 300,
    },
    // Fine-grained event type for filtering and icon selection
    action: {
      type: String,
      enum: [
        'task_created', 'task_completed', 'task_updated', 'task_deleted',
        'project_created', 'project_updated', 'project_deleted',
        'note_created', 'note_updated', 'note_deleted',
        'planner_created', 'planner_completed',
      ],
      required: true,
    },
    // Optional context snapshot (title at time of event, project name, etc.)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    // We only ever read activities in reverse chronological order
    // so an index on (owner, createdAt desc) is essential.
  }
)

activitySchema.index({ owner: 1, createdAt: -1 })

export default mongoose.model('Activity', activitySchema)
