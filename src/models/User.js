import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String, default: '' },
    providers: { type: [String], default: [] },
    lastLoginAt: { type: Date },
    githubToken: { type: String, select: false },
    bio: { type: String, default: '' },
    username: { type: String, default: '' },

    /** undefined = existing user (treated as completed); false = new user pending onboarding */
    onboardingCompleted: { type: Boolean },

    /** Stores all answers collected during the onboarding flow */
    onboarding: {
      role: { type: String, default: '' },
      techStack: { type: [String], default: [] },
      connectedTools: { type: [String], default: [] },
      mainProject: {
        name: { type: String, default: '' },
        description: { type: String, default: '' },
        framework: { type: String, default: '' },
        repository: { type: String, default: '' },
      },
      goals: { type: [String], default: [] },
      schedule: {
        preferredTime: { type: String, default: '' },
        hoursPerDay: { type: Number, default: 4 },
        morningBriefing: { type: Boolean, default: true },
      },
      focusSettings: {
        pomodoroDuration: { type: Number, default: 25 },
        autoStartNext: { type: Boolean, default: false },
      },
      aiPreferences: {
        experience: { type: String, default: '' },
        tone: { type: String, default: '' },
        helpStyle: { type: [String], default: [] },
      },
      dashboardWidgets: { type: [String], default: [] },
    },

    settings: {
      theme: { type: String, default: 'dark' },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        sound: { type: Boolean, default: true }
      },
      timezone: { type: String, default: 'UTC' },
      language: { type: String, default: 'en' },
      connectedAccounts: {
        githubConnected: { type: Boolean, default: false },
        googleConnected: { type: Boolean, default: false },
        linkedinConnected: { type: Boolean, default: false }
      }
    }
  },
  { timestamps: true },
)

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatarUrl: this.avatarUrl,
    providers: this.providers,
    createdAt: this.createdAt,
    bio: this.bio || '',
    username: this.username || '',
    onboardingCompleted: this.onboardingCompleted,
    onboarding: this.onboarding || {},
    settings: this.settings || {
      theme: 'dark',
      notifications: { email: true, sms: false, sound: true },
      timezone: 'UTC',
      language: 'en',
      connectedAccounts: { githubConnected: false, googleConnected: false, linkedinConnected: false }
    }
  }
}

export default mongoose.model('User', userSchema)
