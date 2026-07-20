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
    title: {
      type: String,
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
    deadline: {
      type: Date,
    },
    startDate: {
      type: Date,
    },
    tags: {
      type: [String],
      default: [],
    },
    techStack: {
      type: [String],
      default: [],
    },
    technologies: {
      type: [String],
      default: [],
    },
    githubRepo: {
      type: String,
      default: '',
      trim: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ],
    sprints: [
      {
        name: { type: String, required: true },
        startDate: { type: Date },
        endDate: { type: Date },
        status: { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' }
      }
    ],
    timeline: [
      {
        title: String,
        date: Date,
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed'],
          default: 'pending'
        }
      }
    ],
    roadmap: [
      {
        title: String,
        status: {
          type: String,
          enum: ['planned', 'in_progress', 'done'],
          default: 'planned'
        }
      }
    ],
    documentation: [
      {
        title: String,
        url: String
      }
    ],
    deployments: [
      {
        environment: String,
        url: String,
        status: {
          type: String,
          enum: ['success', 'failed', 'pending'],
          default: 'success'
        },
        deployedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    aiSummary: {
      type: String,
      default: ''
    },
    metrics: {
      progress: { type: Number, default: 0 },
      openIssues: { type: Number, default: 0 },
      features: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
)

// Pre-validate hook to synchronize new and legacy project fields
projectSchema.pre('validate', function(next) {
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }
  
  if (this.progress !== undefined) {
    if (!this.metrics) this.metrics = {};
    this.metrics.progress = this.progress;
  } else if (this.metrics && this.metrics.progress !== undefined) {
    this.progress = this.metrics.progress;
  }

  if (this.deadline && !this.dueDate) {
    this.dueDate = this.deadline;
  } else if (this.dueDate && !this.deadline) {
    this.deadline = this.dueDate;
  }

  if (this.technologies && this.technologies.length > 0 && (!this.techStack || this.techStack.length === 0)) {
    this.techStack = this.technologies;
  } else if (this.techStack && this.techStack.length > 0 && (!this.technologies || this.technologies.length === 0)) {
    this.technologies = this.techStack;
  }
  
  // Keep isArchived in sync with status
  if (this.status === 'archived') {
    this.isArchived = true;
  } else if (this.isArchived) {
    this.status = 'archived';
  }

  next();
});

// Compound indexes for common queries
projectSchema.index({ owner: 1, status: 1 })
projectSchema.index({ owner: 1, dueDate: 1 })

export default mongoose.model('Project', projectSchema)
