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
