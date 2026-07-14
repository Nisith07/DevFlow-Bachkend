import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String, default: '' },
    providers: { type: [String], default: [] },
    lastLoginAt: { type: Date }
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
  }
}

export default mongoose.model('User', userSchema)
